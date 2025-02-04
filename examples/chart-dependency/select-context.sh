#!/bin/bash

# Demander à l'utilisateur de choisir parmi les options
options=("minio-s3" "bucket-amazon-s3" "distant-backend-fs")
PS3="Select the example you want to run: "

select opt in "${options[@]}"
do
    if [ -n "$opt" ]; then
        echo "$opt" > .selected_context
        break
    else
        echo "Invalid selection. Please try again."
    fi
done
