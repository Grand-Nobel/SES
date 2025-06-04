# This is the main Terraform configuration for the development environment.
# It will call various modules defined in terraform/modules/.

# Example: Configure AWS provider
provider "aws" {
  region = "us-east-1" # Development: Single-region, minimal redundancy, cost-optimized.
}

# Example: Reference a networking module
# module "networking" {
#   source = "../../modules/networking"
#   environment = "development"
#   vpc_cidr_block = "10.0.0.0/16"
# }

# Example: Reference a compute module
# module "compute" {
#   source = "../../modules/compute"
#   environment = "development"
#   instance_type = "t3.micro"
# }