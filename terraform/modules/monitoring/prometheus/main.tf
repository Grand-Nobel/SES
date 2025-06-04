# This module defines Prometheus resources.

resource "kubernetes_manifest" "prometheus_operator" {
  manifest = {
    apiVersion = "apps.coreos.com/v1"
    kind       = "PrometheusOperator"
    metadata = {
      name      = "prometheus-operator"
      namespace = var.kubernetes_namespace
    }
    spec = {
      # Simplified spec for placeholder
      # In a real scenario, this would include detailed configuration
      # for serviceMonitorSelector, podMonitorSelector, etc.
    }
  }
}

resource "kubernetes_manifest" "prometheus" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "Prometheus"
    metadata = {
      name      = "${var.environment}-prometheus"
      namespace = var.kubernetes_namespace
    }
    spec = {
      replicas = var.prometheus_replicas
      serviceAccountName = "prometheus"
      serviceMonitorSelector = {
        matchLabels = {
          release = "prometheus"
        }
      }
      podMonitorSelector = {
        matchLabels = {
          release = "prometheus"
        }
      }
      resources = {
        requests = {
          memory = var.prometheus_memory_request
          cpu    = var.prometheus_cpu_request
        }
        limits = {
          memory = var.prometheus_memory_limit
          cpu    = var.prometheus_cpu_limit
        }
      }
      storage = {
        volumeClaimTemplate = {
          spec = {
            storageClassName = var.storage_class_name
            resources = {
              requests = {
                storage = var.prometheus_storage_size
              }
            }
          }
        }
      }
      # Add Thanos sidecar configuration here for long-term storage
      # containers = [
      #   {
      #     name  = "thanos-sidecar"
      #     image = "quay.io/thanos/thanos:v0.32.2"
      #     args = [
      #       "sidecar",
      #       "--tsdb.path=/prometheus",
      #       "--objstore.config=$(OBJSTORE_CONFIG)",
      #     ]
      #     env = [
      #       {
      #         name = "OBJSTORE_CONFIG"
      #         value_from = {
      #           secret_key_ref = {
      #             name = "thanos-objstore-config"
      #             key  = "config"
      #           }
      #         }
      #       }
      #     ]
      #   }
      # ]
    }
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

variable "prometheus_replicas" {
  description = "Number of Prometheus replicas."
  type        = number
  default     = 1
}

variable "prometheus_cpu_request" {
  description = "CPU request for Prometheus pods."
  type        = string
  default     = "200m"
}

variable "prometheus_memory_request" {
  description = "Memory request for Prometheus pods."
  type        = string
  default     = "512Mi"
}

variable "prometheus_cpu_limit" {
  description = "CPU limit for Prometheus pods."
  type        = string
  default     = "1"
}

variable "prometheus_memory_limit" {
  description = "Memory limit for Prometheus pods."
  type        = string
  default     = "2Gi"
}

variable "prometheus_storage_size" {
  description = "Storage size for Prometheus persistent volumes."
  type        = string
  default     = "100Gi"
}

variable "storage_class_name" {
  description = "The name of the Kubernetes StorageClass to use for Prometheus PVs."
  type        = string
  default     = "gp2"
}