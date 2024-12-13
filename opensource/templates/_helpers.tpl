{{- define "minioService" -}}
{{ .Release.Name }}-minio
{{- end -}}

{{- define "redisService" -}}
{{ .Release.Name }}-redis-service
{{- end -}}

{{- define "mediaService" -}}
http://{{ .Release.Name }}-media-service
{{- end -}}