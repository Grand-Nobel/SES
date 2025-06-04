# This module defines storage resources like S3/GCS buckets and Kubernetes Persistent Volumes.

# Example: AWS S3 Bucket
resource "aws_s3_bucket" "main_bucket" {
  bucket = "${var.environment}-${var.component_name}-bucket"
  acl    = "private" # Or appropriate ACL

  tags = {
    Name        = "${var.environment}-${var.component_name}-bucket"
    Environment = var.environment
    Component   = var.component_name
    ManagedBy   = "terraform"
  }
}

# Example: Kubernetes Persistent Volume Claim (for general use, e.g., application data)
resource "kubernetes_persistent_volume_claim" "app_pvc" {
  metadata {
    name      = "${var.environment}-${var.component_name}-pvc"
    namespace = var.kubernetes_namespace
    labels = {
      app = var.component_name
      environment = var.environment
    }
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name
    resources {
      requests = {
        storage = var.pvc_storage_size
      }
    }
  }
}

variable "environment" {
  description = "The deployment environment (e.g., development, staging, production)."
  type        = string
}

variable "component_name" {
  description = "The name of the component using this storage (e.g., backups, logs, app-data)."
  type        = string
}

variable "kubernetes_namespace" {
  description = "The Kubernetes namespace to deploy PVCs into."
  type        = string
  default     = "default"
}

variable "storage_class_name" {
  description = "The name of the Kubernetes StorageClass to use for PVs."
  type        = string
  default     = "gp2"
}

variable "pvc_storage_size" {
  description = "The size of the Persistent Volume Claim."
  type        = string
  default     = "10Gi"
}