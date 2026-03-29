import chromadb
import uuid


def build_vectorstore(chunks: list[dict]):
    client = chromadb.PersistentClient(path=".chroma_db")
    collection = client.get_or_create_collection(name="resume")

    texts = [c["text"] for c in chunks]
    metadatas = [{"section": c["section"]} for c in chunks]
    ids = [str(uuid.uuid4()) for _ in chunks]

    collection.add(documents=texts, metadatas=metadatas, ids=ids)
    return collection


def query(collection, text: str, n: int = 4) -> list[str]:
    results = collection.query(query_texts=[text], n_results=min(n, collection.count()))
    return results["documents"][0] if results["documents"] else []
