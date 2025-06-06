# This module defines load balancing and ingress resources using Traefik.

# Example: Traefik Ingress Controller Deployment (simplified)
resource "kubernetes_deployment" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.kubernetes_namespace
    labels = {
      app = "traefik"
      environment = var.environment
    }
  }
  spec {
    replicas = var.traefik_replicas
    selector {
      match_labels = {
        app = "traefik"
      }
    }
    template {
      metadata {
        labels = {
          app = "traefik"
          environment = var.environment
        }
      }
      spec {
        service_account_name = "traefik-ingress-controller"
        container {
          name  = "traefik"
          image = "traefik:v2.10" # Example image
          args = [
            "--api.dashboard=true",
            "--providers.kubernetesingress",
            "--entrypoints.web.address=:80",
            "--entrypoints.websecure.address=:443",
            "--entrypoints.websecure.http.tls",
            "--certificatesresolvers.le.acme.email=${var.acme_email}",
            "--certificatesresolvers.le.acme.storage=/data/acme.json",
            "--certificatesresolvers.le.acme.tlschallenge", # Or httpchallenge/dnschallenge
          ]
          port {
            container_port = 80
            name           = "web"
          }
          port {
            container_port = 443
            name           = "websecure"
          }
          port {
            container_port = 8080
            name           = "api"
          }
          volume_mount {
            name       = "data"
            mount_path = "/data"
          }
        }
        volume {
          name = "data"
          empty_dir {} # For ACME storage, should be persistent in production
        }
      }
    }
  }
}

# Example: Traefik Service (LoadBalancer)
resource "kubernetes_service" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.kubernetes_namespace
    labels = {
      app = "traefik"
      environment = var.environment
    }
  }
  spec {
    selector = {
      app = "traefik"
    }
    port {
      port        = 80
      target_port = 80
      protocol    = "TCP"
      name        = "web"
    }
    port {
      port        = 443
      target_port = 443
      protocol    = "TCP"
      name        = "websecure"
    }
    type = "LoadBalancer"
  }
}

# Example: Cert-Manager Issuer (simplified)
resource "kubernetes_manifest" "cert_manager_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "letsencrypt-prod"
    }
    spec = {
      acme = {
        email = var.acme_email
        server = "https://acme-v02.api.letsencrypt.org/directory"
        privateKeySecretRef = {
          name = "letsencrypt-prod"
        }
        solvers = [
          {
            tls01 = {} # Or http01/dns01
          }
        ]
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
  default     = "traefik"
}

variable "traefik_replicas" {
  description = "Number of Traefik replicas."
  type        = number
  default     = 2
}

variable "acme_email" {
  description = "Email for ACME (Let's Encrypt) certificate registration."
  type        = string
}