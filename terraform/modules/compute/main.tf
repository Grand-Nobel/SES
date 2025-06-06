# This module defines compute resources, primarily Kubernetes cluster definitions.

resource "aws_eks_cluster" "main" {
  name     = "${var.environment}-eks-cluster"
  role_arn = var.eks_cluster_role_arn
  version  = "1.28" # As specified in the DevOps plan

  vpc_config {
    subnet_ids = var.subnet_ids
  }

  tags = {
    Name        = "${var.environment}-eks-cluster"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

variable "environment" {
  description = "The deployment environment (e.g., development, staging, production)."
  type        = string
}

variable "eks_cluster_role_arn" {
  description = "The ARN of the IAM role for the EKS cluster."
  type        = string
}

variable "subnet_ids" {
  description = "A list of subnet IDs for the EKS cluster."
  type        = list(string)
}