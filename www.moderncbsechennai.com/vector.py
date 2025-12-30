import os
import json
import hashlib
import shutil
from typing import Dict, List
import google.auth
from google.cloud import storage
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# ------------------ CONFIG ------------------ #
BUCKET_NAME = "msss-text-files"
DATA_DIR = "data"
VECTOR_STORE_PATH = "faiss_index"
HASH_FILE = "file_hashes.json"

_VECTOR_CACHE = {}

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)


# ------------------ Embeddings ------------------ #
def _get_embeddings():
    return OpenAIEmbeddings(model="text-embedding-3-small")


# ------------------ Text Split ------------------ #
def _split_text(text: str) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150
    )
    return [Document(page_content=chunk) for chunk in splitter.split_text(text)]


# ------------------ Hash Utils ------------------ #
def _hash(text: str):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _load_hashes() -> Dict[str, str]:
    if os.path.exists(HASH_FILE):
        with open(HASH_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_hashes(data: Dict[str, str]):
    with open(HASH_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ------------------ GCP Storage Client ------------------ #
def get_storage_client():
    credentials, project = google.auth.default()
    return storage.Client(credentials=credentials, project=project)


# ------------------ Sync Bucket Files ------------------ #
def sync_bucket_files_to_local() -> bool:
    print(">>> Syncing bucket files...")
    client = get_storage_client()
    bucket = client.bucket(BUCKET_NAME)

    old_hashes = _load_hashes()
    new_hashes = {}
    changed = False
    current_files = set()

    # Add/update files
    for blob in bucket.list_blobs():
        if not blob.name.endswith(".txt"):
            continue

        current_files.add(blob.name)
        content = blob.download_as_text()
        digest = _hash(content)
        new_hashes[blob.name] = digest
        local_path = os.path.join(DATA_DIR, blob.name)

        if old_hashes.get(blob.name) != digest:
            with open(local_path, "w", encoding="utf-8") as f:
                f.write(content)
            changed = True
            print(f"⬇️ Updated → {blob.name}")

    # Delete removed files locally
    for local_file in os.listdir(DATA_DIR):
        if local_file.endswith(".txt") and local_file not in current_files:
            os.remove(os.path.join(DATA_DIR, local_file))
            changed = True
            print(f"🗑 Removed → {local_file}")

    if changed:
        _save_hashes(new_hashes)
        print("⚠️ Changes detected → will rebuild FAISS")
    else:
        print("✔ No changes detected")

    return changed


# ------------------ Reset FAISS Index ------------------ #
def _reset_index():
    if os.path.exists(VECTOR_STORE_PATH):
        shutil.rmtree(VECTOR_STORE_PATH)
    _VECTOR_CACHE.clear()
    print("🧨 FAISS index cleared")


# ------------------ Load Documents ------------------ #
def load_all_files() -> List[Document]:
    docs = []
    for file in os.listdir(DATA_DIR):
        if file.endswith(".txt"):
            path = os.path.join(DATA_DIR, file)
            with open(path, "r", encoding="utf-8") as f:
                docs.extend(_split_text(f.read()))
    return docs


# ------------------ Main Loader ------------------ #
def load_vector_store():
    global _VECTOR_CACHE

    changed = sync_bucket_files_to_local()
    if changed:
        _reset_index()

    if not changed and "retriever" in _VECTOR_CACHE:
        print("✔ Serving from memory cache")
        return _VECTOR_CACHE["retriever"]

    if not os.path.exists(VECTOR_STORE_PATH):
        print("🛠 Rebuilding FAISS index...")
        docs = load_all_files()
        if not docs:
            print("⚠️ No documents found.")
            return None
        vs = FAISS.from_documents(docs, _get_embeddings())
        vs.save_local(VECTOR_STORE_PATH)
    else:
        print("📂 Loading FAISS index from disk...")
        vs = FAISS.load_local(
            VECTOR_STORE_PATH,
            _get_embeddings(),
            allow_dangerous_deserialization=True,
        )

    retriever = vs.as_retriever(search_kwargs={"k": 3})
    _VECTOR_CACHE["retriever"] = retriever
    print("✅ Vector store ready.")
    return retriever


# ------------------ CLI Run Test ------------------ #
if __name__ == "__main__":
    load_vector_store()
