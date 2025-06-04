# This module defines security resources like IAM roles, KMS keys, and Secret Manager.

# Example: AWS IAM Role for EKS Cluster
resource "aws_iam_role" "eks_cluster_role" {
  name = "${var.environment}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-eks-cluster-role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

resource "aws_iam_role_policy_attachment" "eks_service_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

# Example: AWS KMS Key
resource "aws_kms_key" "app_key" {
  description             = "${var.environment} application encryption key"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name        = "${var.environment}-app-key"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Example: AWS Secrets Manager Secret
resource "aws_secretsmanager_secret" "app_secret" {
  name        = "${var.environment}/app/jwt_secret"
  description = "JWT secret for ${var.environment} environment."

  tags = {
    Name        = "${var.environment}-app-jwt-secret"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

variable "environment" {
  description = "The deployment environment (e.g., development, staging, production)."
  type        = string
}