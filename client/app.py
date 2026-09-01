import os

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:4000/api/signed-url")

st.title("Signed URL Upload Demo")
st.caption(f"Requesting signed URLs from {API_URL}")

uploaded_file = st.file_uploader("Choose a file to upload")

if uploaded_file is not None:
    content_type = uploaded_file.type or "application/octet-stream"

    if st.button("Upload to S3"):
        with st.spinner("Requesting signed URL..."):
            try:
                resp = requests.post(
                    API_URL,
                    json={"filename": uploaded_file.name, "contentType": content_type},
                    timeout=10,
                )
                resp.raise_for_status()
                payload = resp.json()
            except requests.RequestException as exc:
                st.error(f"Failed to get signed URL: {exc}")
                st.stop()

        upload_url = payload["uploadUrl"]
        key = payload["key"]

        with st.spinner("Uploading to S3..."):
            try:
                put_resp = requests.put(
                    upload_url,
                    data=uploaded_file.getvalue(),
                    headers={"Content-Type": content_type},
                    timeout=60,
                )
            except requests.RequestException as exc:
                st.error(f"Upload failed: {exc}")
                st.stop()

        if put_resp.status_code == 200:
            st.success(f"Uploaded successfully. S3 key: {key}")
        else:
            st.error(f"Upload failed ({put_resp.status_code}): {put_resp.text}")
