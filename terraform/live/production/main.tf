# This is the main Terraform configuration for the production environment.
# It will call various modules defined in terraform/modules/.

# Example: Configure AWS provider for primary region
provider "aws" {
  alias  = "primary"
  region = "us-east-1" # Production: Multi-region, full high-availability.
}

# Example: Configure AWS provider for disaster recovery region
provider "aws" {
  alias  = "dr"
  region = "eu-west-1" # Production: Multi-region, full high-availability.
}

# Example: Reference a networking module for primary region
# module "networking_primary" {
#   source = "../../modules/networking"
#   providers = {
#     aws = aws.primary
#   }
#   environment = "production"
#   region = "us-east-1"
#   vpc_cidr_block = "10.2.0.0/16"
# }

# Example: Reference a networking module for DR region
# module "networking_dr" {
#   source = "../../modules/networking"
#   providers = {
#     aws = aws.dr
#   }
#   environment = "production"
#   region = "eu-west-1"
#   vpc_cidr_block = "10.3.0.0/16"
# }

# Example: Reference a compute module
# module "compute" {
#   source = "../../modules/compute"
#   environment = "production"
#   instance_type = "m5.xlarge"
# }