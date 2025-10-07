#!/bin/bash
DUMP_FILE_PATH="/dumps/dump.rdb"

HOST="${DELEGATED_STORAGE_HOST}"
BACKUP_PATH="${URL_TO_GET_BACKUP}"
TOKEN="${DELEGATED_STORAGE_TOKEN}"

# Fonction pour télécharger le fichier dump distant
download_dump() {
  local dump_file_name="$1"
  local url="$HOST$BACKUP_PATH/$dump_file_name?format=rdb"

  echo "Attempting to download: $url"
  echo "Using token: ${TOKEN:0:10}..." # Affiche seulement les 10 premiers caractères du token

  # Utiliser une variable temporaire pour capturer les détails de l'erreur
  local temp_file=$(mktemp)
  local http_code

  http_code=$(curl -L --fail --silent --write-out "%{http_code}" \
    -o "${DUMP_FILE_PATH}" \
    -H "Authorization: Bearer $TOKEN" \
    "$url" 2>"$temp_file")

  local curl_exit_code=$?

  if [ $curl_exit_code -ne 0 ]; then
    echo "❌ Download failed for: $dump_file_name" >&2
    echo "   URL: $url" >&2
    echo "   HTTP Code: $http_code" >&2
    echo "   Curl exit code: $curl_exit_code" >&2
    echo "   Error details:" >&2
    cat "$temp_file" >&2

    # Diagnostics supplémentaires
    case $curl_exit_code in
      6)  echo "   → Couldn't resolve host: $HOST" >&2 ;;
      7)  echo "   → Failed to connect to host" >&2 ;;
      22) echo "   → HTTP error (status >= 400)" >&2 ;;
      28) echo "   → Operation timeout" >&2 ;;
      *)  echo "   → Unknown curl error" >&2 ;;
    esac

    # Vérifier si le fichier de destination existe et sa taille
    if [ -f "${DUMP_FILE_PATH}" ]; then
      local file_size=$(stat -c%s "${DUMP_FILE_PATH}" 2>/dev/null || echo "unknown")
      echo "   → Partial file created (size: $file_size bytes)" >&2
      rm -f "${DUMP_FILE_PATH}" # Nettoyer le fichier partiel
    fi
  else
    echo "✅ Successfully downloaded: $dump_file_name"
    local file_size=$(stat -c%s "${DUMP_FILE_PATH}" 2>/dev/null || echo "unknown")
    echo "   File size: $file_size bytes"
  fi

  rm -f "$temp_file"
  return $curl_exit_code
}

# Vérifier la présence de dump.rdb pour déterminer la stratégie
if [ -f "${DUMP_FILE_PATH}" ]; then
  echo "🔍 Dump found. Proceeding with restart."

  if [ "${RESTORE_ON_RESTART}" = "true" ]; then
    echo "🔄 Restoration on restart is enabled"
    echo "📥 Downloading: ${DUMP_FILE_NAME_ON_RESTART}"
    download_dump "${DUMP_FILE_NAME_ON_RESTART}"

    if [ $? -ne 0 ]; then
      echo "💥 CRITICAL ERROR: Failed to download ${DUMP_FILE_NAME_ON_RESTART}" >&2
      echo "   This may cause data inconsistency issues." >&2
      echo "   Check network connectivity and API availability." >&2
      exit 1
    fi

    echo "✅ Distant dump successfully replaced local."
  else
    echo "⏭️  RESTORE_ON_RESTART is set to false. Keeping current dump.rdb."
  fi

else
  echo "🆕 No dump found. Proceeding with full initialization."
  echo "🗑️  Starting with an empty dump.rdb."
  rm -f "${DUMP_FILE_PATH}"

  if [ "${RESTORE_ON_INIT}" = "true" ]; then
    echo "🔄 Restoration on init is enabled"
    echo "📥 Downloading: ${DUMP_FILE_NAME_ON_INIT}"
    download_dump "${DUMP_FILE_NAME_ON_INIT}"

    if [ $? -ne 0 ]; then
      echo "💥 CRITICAL ERROR: Failed to download ${DUMP_FILE_NAME_ON_INIT}" >&2
      echo "   Initial setup cannot proceed without this dump." >&2
      echo "   Verify the following:" >&2
      echo "   - DELEGATED_STORAGE_HOST: $HOST" >&2
      echo "   - URL_TO_GET_BACKUP: $BACKUP_PATH" >&2
      echo "   - DUMP_FILE_NAME_ON_INIT: $DUMP_FILE_NAME_ON_INIT" >&2
      echo "   - Token validity and permissions" >&2
      exit 1
    fi

    echo "✅ Distant dump successfully loaded during init."
  else
    echo "⏭️  RESTORE_ON_INIT is disabled. Starting with empty Redis."
  fi
fi

echo "🎉 Script completed successfully!"