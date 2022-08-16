data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "postman_bucket" {
  statement {
    principals {
      type        = "AWS"
      identifiers = ["${var.role}"]
    }

    actions = [
      "s3:*"
    ]

    resources = [
      aws_s3_bucket.postman_bucket.arn,
      "${aws_s3_bucket.postman_bucket.arn}/*",
    ]
  }
}