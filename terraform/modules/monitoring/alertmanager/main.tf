# This module defines Alertmanager resources.

resource "kubernetes_manifest" "alertmanager" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "Alertmanager"
    metadata = {
      name      = "${var.environment}-alertmanager"
      namespace = var.kubernetes_namespace
    }
    spec = {
      replicas = var.alertmanager_replicas
      serviceAccountName = "alertmanager"
      resources = {
        requests = {
          memory = var.alertmanager_memory_request
          cpu    = var.alertmanager_cpu_request
        }
        limits = {
          memory = var.alertmanager_memory_limit
          cpu    = var.alertmanager_cpu_limit
        }
      }
      storage = {
        volumeClaimTemplate = {
          spec = {
            storageClassName = var.storage_class_name
            resources = {
              requests = {
                storage = var.alertmanager_storage_size
              }
            }
          }
        }
      }
      # Add Alertmanager configuration here (e.g., receivers, routes)
      # configSecret = {
      #   name = "${var.environment}-alertmanager-config"
      # }
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

variable "alertmanager_replicas" {
  description = "Number of Alertmanager replicas."
  type        = number
  default     = 1
}

variable "alertmanager_cpu_request" {
  description = "CPU request for Alertmanager pods."
  type        = string
  default     = "100m"
}

variable "alertmanager_memory_request" {
  description = "Memory request for Alertmanager pods."
  type        = string
  default     = "128Mi"
}

variable "alertmanager_cpu_limit" {
  description = "CPU limit for Alertmanager pods."
  type        = string
  default     = "200m"
}

variable "alertmanager_memory_limit" {
  description = "Memory limit for Alertmanager pods."
  type        = string
  default     = "256Mi"
}

variable "alertmanager_storage_size" {
  description = "Storage size for Alertmanager persistent volumes."
  type        = string
  default     = "10Gi"
}

variable "storage_class_name" {
  description = "The name of the Kubernetes StorageClass to use for Alertmanager PVs."
  type        = string
  default     = "gp2"
}