# This module defines OpenTelemetry Collector resources.

resource "kubernetes_manifest" "otel_collector_deployment" {
  manifest = {
    apiVersion = "apps/v1"
    kind       = "Deployment"
    metadata = {
      name      = "${var.environment}-otel-collector"
      namespace = var.kubernetes_namespace
      labels = {
        app = "otel-collector"
        environment = var.environment
      }
    }
    spec = {
      replicas = var.otel_collector_replicas
      selector = {
        matchLabels = {
          app = "otel-collector"
        }
      }
      template = {
        metadata = {
          labels = {
            app = "otel-collector"
            environment = var.environment
          }
        }
        spec = {
          container {
            name  = "otel-collector"
            image = "otel/opentelemetry-collector:0.96.0" # Example image
            args = [
              "--config=/conf/collector.yaml"
            ]
            volume_mount {
              name       = "collector-config"
              mount_path = "/conf"
            }
            resources {
              requests = {
                cpu    = var.otel_collector_cpu_request
                memory = var.otel_collector_memory_request
              }
              limits = {
                cpu    = var.otel_collector_cpu_limit
                memory = var.otel_collector_memory_limit
              }
            }
          }
          volume {
            name = "collector-config"
            config_map {
              name = "${var.environment}-otel-collector-config"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_config_map" "otel_collector_config" {
  metadata {
    name      = "${var.environment}-otel-collector-config"
    namespace = var.kubernetes_namespace
  }
  data = {
    "collector.yaml" = <<-EOT
      receivers:
        otlp:
          protocols:
            grpc:
            http:

      processors:
        batch:

      exporters:
        # Example: Export to Jaeger
        jaeger:
          endpoint: "${var.jaeger_collector_endpoint}:14250"
          tls:
            insecure: true # Use false and proper certs in production

        # Example: Export to Prometheus remote write
        prometheusremotewrite:
          endpoint: "${var.prometheus_remote_write_endpoint}"
          tls:
            insecure_skip_verify: true # Use false and proper certs in production

        # Example: Export to Loki (logs)
        loki:
          endpoint: "${var.loki_endpoint}"

      service:
        pipelines:
          traces:
            receivers: [otlp]
            processors: [batch]
            exporters: [jaeger] # Add other trace exporters as needed
          metrics:
            receivers: [otlp]
            processors: [batch]
            exporters: [prometheusremotewrite] # Add other metric exporters as needed
          logs:
            receivers: [otlp]
            processors: [batch]
            exporters: [loki] # Add other log exporters as needed
    EOT
  }
}

variable "environment" {
  description = "The deployment environment (e.g., development, staging, production)."
  type        = string
}

variable "kubernetes_namespace" {
  description = "The Kubernetes namespace to deploy resources into."
  type        = string
  default     = "monitoring"
}

variable "otel_collector_replicas" {
  description = "Number of OpenTelemetry Collector replicas."
  type        = number
  default     = 1
}

variable "otel_collector_cpu_request" {
  description = "CPU request for OpenTelemetry Collector pods."
  type        = string
  default     = "100m"
}

variable "otel_collector_memory_request" {
  description = "Memory request for OpenTelemetry Collector pods."
  type        = string
  default     = "128Mi"
}

variable "otel_collector_cpu_limit" {
  description = "CPU limit for OpenTelemetry Collector pods."
  type        = string
  default     = "200m"
}

variable "otel_collector_memory_limit" {
  description = "Memory limit for OpenTelemetry Collector pods."
  type        = string
  default     = "256Mi"
}

variable "jaeger_collector_endpoint" {
  description = "The endpoint for the Jaeger collector (e.g., jaeger-collector.monitoring.svc.cluster.local)."
  type        = string
}

variable "prometheus_remote_write_endpoint" {
  description = "The endpoint for Prometheus remote write (e.g., http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090/api/v1/write)."
  type        = string
}

variable "loki_endpoint" {
  description = "The endpoint for Loki (e.g., http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push)."
  type        = string
}