# This module defines the Patroni PostgreSQL cluster and Supavisor configuration.

# Example: Patroni PostgreSQL StatefulSet (simplified)
resource "kubernetes_stateful_set" "patroni_cluster" {
  metadata {
    name      = "${var.environment}-patroni"
    namespace = var.kubernetes_namespace
    labels = {
      app = "patroni"
      environment = var.environment
    }
  }
  spec {
    replicas = var.patroni_replicas
    selector {
      match_labels = {
        app = "patroni"
      }
    }
    service_name = "${var.environment}-patroni"
    template {
      metadata {
        labels = {
          app = "patroni"
          environment = var.environment
        }
      }
      spec {
        container {
          name  = "patroni"
          image = "registry.opensource.zalan.do/acid/patroni:2.1.1-pg14" # Example image
          env {
            name  = "PATRONI_SCOPE"
            value = "${var.environment}-pg-cluster"
          }
          env {
            name  = "PATRONI_RESTAPI_LISTEN"
            value = "0.0.0.0:8008"
          }
          env {
            name  = "PATRONI_KUBERNETES_USE_ENDPOINTS"
            value = "true"
          }
          env {
            name  = "PATRONI_KUBERNETES_LABELS"
            value = "app=patroni,environment=${var.environment}"
          }
          env {
            name  = "PATRONI_KUBERNETES_NAMESPACE"
            value = var.kubernetes_namespace
          }
          port {
            container_port = 5432
            name           = "postgresql"
          }
          port {
            container_port = 8008
            name           = "patroni-rest"
          }
          resources {
            requests = {
              cpu    = var.patroni_cpu_request
              memory = var.patroni_memory_request
            }
            limits = {
              cpu    = var.patroni_cpu_limit
              memory = var.patroni_memory_limit
            }
          }
          volume_mount {
            name       = "pgdata"
            mount_path = "/var/lib/postgresql/data"
          }
        }
        volume_claim_template {
          metadata {
            name = "pgdata"
          }
          spec {
            access_modes       = ["ReadWriteOnce"]
            storage_class_name = var.storage_class_name
            resources {
              requests = {
                storage = var.patroni_storage_size
              }
            }
          }
        }
      }
    }
  }
}

# Example: Supavisor Deployment (simplified)
resource "kubernetes_deployment" "supavisor" {
  metadata {
    name      = "${var.environment}-supavisor"
    namespace = var.kubernetes_namespace
    labels = {
      app = "supavisor"
      environment = var.environment
    }
  }
  spec {
    replicas = var.supavisor_replicas
    selector {
      match_labels = {
        app = "supavisor"
      }
    }
    template {
      metadata {
        labels = {
          app = "supavisor"
          environment = var.environment
        }
      }
      spec {
        container {
          name  = "supavisor"
          image = "supabase/supavisor:latest" # Example image
          env {
            name  = "SUPAVISOR_JWT_SECRET"
            value_from {
              secret_key_ref {
                name = var.supavisor_jwt_secret_name
                key  = "jwt_secret"
              }
            }
          }
          env {
            name  = "SUPAVISOR_DEFAULT_POOL_SIZE"
            value = tostring(var.supavisor_default_pool_size)
          }
          port {
            container_port = 6543
            name           = "supavisor"
          }
          resources {
            requests = {
              cpu    = var.supavisor_cpu_request
              memory = var.supavisor_memory_request
            }
            limits = {
              cpu    = var.supavisor_cpu_limit
              memory = var.supavisor_memory_limit
            }
          }
        }
      }
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
  default     = "default"
}

variable "patroni_replicas" {
  description = "Number of Patroni replicas."
  type        = number
  default     = 3
}

variable "patroni_cpu_request" {
  description = "CPU request for Patroni pods."
  type        = string
  default     = "500m"
}

variable "patroni_memory_request" {
  description = "Memory request for Patroni pods."
  type        = string
  default     = "1Gi"
}

variable "patroni_cpu_limit" {
  description = "CPU limit for Patroni pods."
  type        = string
  default     = "1"
}

variable "patroni_memory_limit" {
  description = "Memory limit for Patroni pods."
  type        = string
  default     = "2Gi"
}

variable "patroni_storage_size" {
  description = "Storage size for Patroni persistent volumes."
  type        = string
  default     = "50Gi"
}

variable "storage_class_name" {
  description = "The name of the Kubernetes StorageClass to use for Patroni PVs."
  type        = string
  default     = "gp2" # Example for AWS
}

variable "supavisor_replicas" {
  description = "Number of Supavisor replicas."
  type        = number
  default     = 2
}

variable "supavisor_cpu_request" {
  description = "CPU request for Supavisor pods."
  type        = string
  default     = "200m"
}

variable "supavisor_memory_request" {
  description = "Memory request for Supavisor pods."
  type        = string
  default     = "256Mi"
}

variable "supavisor_cpu_limit" {
  description = "CPU limit for Supavisor pods."
  type        = string
  default     = "500m"
}

variable "supavisor_memory_limit" {
  description = "Memory limit for Supavisor pods."
  type        = string
  default     = "512Mi"
}

variable "supavisor_jwt_secret_name" {
  description = "The name of the Kubernetes secret containing the Supavisor JWT secret."
  type        = string
}

variable "supavisor_default_pool_size" {
  description = "The default pool size for Supavisor connections."
  type        = number
  default     = 20
}