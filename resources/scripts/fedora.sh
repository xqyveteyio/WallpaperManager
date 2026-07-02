#!/bin/bash
# Usage: fedora.sh <local-file-path>
# Sets the GNOME desktop wallpaper on Fedora.

FILE="$1"

if [[ -z "$FILE" ]]; then
    echo "Error: no file path provided" >&2
    exit 1
fi

FILE_URI="file://${FILE}"

gsettings set org.gnome.desktop.background picture-uri       "$FILE_URI"
gsettings set org.gnome.desktop.background picture-uri-dark  "$FILE_URI"
