# This is the main Terraform configuration for the staging environment.
# It will call various modules defined in terraform/modules/.

# Example: Configure AWS provider
provider "aws" {
  region = "us-east-1" # Staging: Mirrors production architecture (multi-AZ, single region), scaled-down resources.
}

# Example: Reference a networking module
# module "networking" {
#   source = "../../modules/networking"
#   environment = "staging"
#   vpc_cidr_block = "10.1.0.0/16"
# }

# Example: Reference a compute module
# module "compute" {
#   source = "../../modules/compute"
#   environment = "staging"
#   instance_type = "m5.large"
# }