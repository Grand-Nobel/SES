# This module defines Grafana resources.

resource "kubernetes_manifest" "grafana_deployment" {
  manifest = {
    apiVersion = "apps/v1"
    kind       = "Deployment"
    metadata = {
      name      = "${var.environment}-grafana"
      namespace = var.kubernetes_namespace
      labels = {
        app = "grafana"
        environment = var.environment
      }
    }
    spec = {
      replicas = var.grafana_replicas
      selector = {
        matchLabels = {
          app = "grafana"
        }
      }
      template = {
        metadata = {
          labels = {
            app = "grafana"
            environment = var.environment
          }
        }
        spec = {
          container {
            name  = "grafana"
            image = "grafana/grafana:10.2.3" # Example image
            port {
              container_port = 3000
              name           = "http"
            }
            env {
              name  = "GF_SECURITY_ADMIN_USER"
              value = var.grafana_admin_user
            }
            env {
              name  = "GF_SECURITY_ADMIN_PASSWORD"
              value_from {
                secret_key_ref {
                  name = var.grafana_admin_password_secret_name
                  key  = "admin-password"
                }
              }
            }
            resources {
              requests = {
                cpu    = var.grafana_cpu_request
                memory = var.grafana_memory_request
              }
              limits = {
                cpu    = var.grafana_cpu_limit
                memory = var.grafana_memory_limit
              }
            }
            volume_mount {
              name       = "grafana-storage"
              mount_path = "/var/lib/grafana"
            }
          }
          volume {
            name = "grafana-storage"
            persistent_volume_claim {
              claim_name = "${var.environment}-grafana-pvc"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "grafana_pvc" {
  metadata {
    name      = "${var.environment}-grafana-pvc"
    namespace = var.kubernetes_namespace
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name
    resources {
      requests = {
        storage = var.grafana_storage_size
      }
    }
  }
}

resource "kubernetes_service" "grafana_service" {
  metadata {
    name      = "${var.environment}-grafana"
    namespace = var.kubernetes_namespace
    labels = {
      app = "grafana"
      environment = var.environment
    }
  }
  spec {
    selector = {
      app = "grafana"
    }
    port {
      port        = 3000
      target_port = 3000
      protocol    = "TCP"
      name        = "http"
    }
    type = "ClusterIP" # Or LoadBalancer if exposing externally
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

variable "grafana_replicas" {
  description = "Number of Grafana replicas."
  type        = number
  default     = 1
}

variable "grafana_cpu_request" {
  description = "CPU request for Grafana pods."
  type        = string
  default     = "100m"
}

variable "grafana_memory_request" {
  description = "Memory request for Grafana pods."
  type        = string
  default     = "128Mi"
}

variable "grafana_cpu_limit" {
  description = "CPU limit for Grafana pods."
  type        = string
  default     = "200m"
}

variable "grafana_memory_limit" {
  description = "Memory limit for Grafana pods."
  type        = string
  default     = "256Mi"
}

variable "grafana_storage_size" {
  description = "Storage size for Grafana persistent volumes."
  type        = string
  default     = "10Gi"
}

variable "storage_class_name" {
  description = "The name of the Kubernetes StorageClass to use for Grafana PVs."
  type        = string
  default     = "gp2"
}

variable "grafana_admin_user" {
  description = "Grafana admin username."
  type        = string
}

variable "grafana_admin_password_secret_name" {
  description = "The name of the Kubernetes secret containing the Grafana admin password."
  type        = string
}