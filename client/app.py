import os

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:4000/api")
SDK_ENDPOINT = f"{API_BASE_URL}/signed-url"
MANUAL_ENDPOINT = f"{API_BASE_URL}/signed-url-manual"

st.title("Signed URL Upload Demo")

mode = st.radio(
    "Signing method",
    ["AWS SDK (getSignedUrl)", "Manual SigV4 (from scratch)"],
    help=(
        "AWS SDK: the backend calls @aws-sdk/s3-request-presigner. "
        "Manual: the backend signs the URL itself with raw HMAC-SHA256, no AWS SDK involved."
    ),
)
endpoint = SDK_ENDPOINT if mode.startswith("AWS SDK") else MANUAL_ENDPOINT

st.caption(f"Requesting signed URLs from {endpoint}")

uploaded_file = st.file_uploader("Choose a file to upload")

if uploaded_file is not None:
    content_type = uploaded_file.type or "application/octet-stream"

    if st.button("Upload to S3"):
        with st.spinner("Requesting signed URL..."):
            try:
                resp = requests.post(
                    endpoint,
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
        steps = payload.get("steps")

        if steps:
            st.subheader("How this URL was signed (AWS Signature Version 4)")

            st.markdown(
                "**1. Canonical request** — method, path, query string, headers "
                "and payload hash, reduced to one exact byte string."
            )
            st.code(steps["canonicalRequest"], language="text")

            st.markdown("**2. SHA-256 hash of the canonical request**")
            st.code(steps["hashedCanonicalRequest"], language="text")

            st.markdown(
                "**3. String to sign** — algorithm, timestamp, credential scope "
                "(date/region/service), and the hash above."
            )
            st.code(steps["stringToSign"], language="text")

            st.markdown(
                "**4. Signing key derivation** — four nested HMAC-SHA256 calls "
                "scope the key to this exact date, region and service."
            )
            chain = steps["signingKeyChain"]
            st.code(
                "kDate    = HMAC('AWS4' + secretKey, \"{date}\")\n"
                "         = {kDate}\n"
                "kRegion  = HMAC(kDate, \"{region}\")\n"
                "         = {kRegion}\n"
                "kService = HMAC(kRegion, \"s3\")\n"
                "         = {kService}\n"
                "kSigning = HMAC(kService, \"aws4_request\")\n"
                "         = {kSigning}".format(
                    date=steps["dateStamp"],
                    region=steps["region"],
                    kDate=chain["kDate"],
                    kRegion=chain["kRegion"],
                    kService=chain["kService"],
                    kSigning=chain["kSigning"],
                ),
                language="text",
            )

            st.markdown("**5. Final signature** — HMAC-SHA256(signingKey, stringToSign)")
            st.code(steps["signature"], language="text")

        st.markdown("**Resulting presigned URL**")
        st.code(upload_url, language="text")

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
