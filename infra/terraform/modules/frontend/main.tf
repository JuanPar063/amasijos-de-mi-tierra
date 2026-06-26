# Frontend estático: S3 (privado) + CloudFront (con Origin Access Control).
variable "nombre" { type = string }
variable "api_origin_domain" {
  type        = string
  description = "DNS del ALB del backend; CloudFront enruta /api/* hacia ahí."
}
variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_caller_identity" "me" {}

resource "aws_s3_bucket" "this" {
  bucket        = "${var.nombre}-frontend-${data.aws_caller_identity.me.account_id}"
  force_destroy = true
  tags          = var.tags
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.nombre}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  # Origen del backend (ALB) para enrutar las llamadas a /api desde el mismo
  # dominio HTTPS de CloudFront (evita CORS y "mixed content").
  origin {
    domain_name = var.api_origin_domain
    origin_id   = "api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # Managed-AllViewer
  }

  # La SPA usa hash routing, pero por si acaso servimos index.html en 403/404.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.tags
}

# Solo CloudFront puede leer el bucket.
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.this.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.this.arn } }
    }]
  })
}

output "bucket_name" { value = aws_s3_bucket.this.id }
output "distribution_id" { value = aws_cloudfront_distribution.this.id }
output "url" { value = "https://${aws_cloudfront_distribution.this.domain_name}" }
