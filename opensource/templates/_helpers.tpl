{{- define "minioService" -}}
tada-{{ .Release.Name }}-minio
{{- end -}}

{{- define "redisService" -}}
tada-{{ .Release.Name }}-redis-service
{{- end -}}

{{- define "mediaService" -}}
http://tada-{{ .Release.Name }}-media-service
{{- end -}}