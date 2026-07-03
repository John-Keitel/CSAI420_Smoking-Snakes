#!/bin/bash
# force error if any command fails
set -e

# Load .env.docker file if it exists
if [ -f .env.docker ]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Ignore lines starting with # and empty lines
        if [[ ! "$line" =~ ^\s*# ]] && [[ -n "$line" ]]; then
            # shellcheck disable=SC2163
            export "$line"
        fi
    done < .env.docker
fi

export AWS_ACCESS_KEY_ID="virtualintercom"
export AWS_SECRET_ACCESS_KEY="virtualintercom"

MINIO_PORT="${MINIO_PORT:-1091}"
MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-1090}"
BUCKET_NAME="virtualintercom"

# Function to check if bucket exists
bucket_exists() {
    aws --endpoint-url http://localhost:"${MINIO_PORT}" s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null
    return $?
}
# Check if bucket exists, create if it doesn't
if bucket_exists; then
    echo "Bucket '${BUCKET_NAME}' already exists."
    aws --endpoint-url http://localhost:"${MINIO_PORT}" s3api delete-bucket --bucket "${BUCKET_NAME}" >/dev/null
    echo "Bucket '${BUCKET_NAME}' deleted successfully."
fi

aws --endpoint-url http://localhost:"${MINIO_PORT}" s3api create-bucket --bucket "${BUCKET_NAME}" >/dev/null
echo "Bucket '${BUCKET_NAME}' created successfully."

echo "Setting bucket policy..."
aws --endpoint-url http://localhost:"${MINIO_PORT}" s3api put-bucket-policy --bucket "${BUCKET_NAME}" --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::'"$BUCKET_NAME"'/public/*"
        }
    ]
}'
