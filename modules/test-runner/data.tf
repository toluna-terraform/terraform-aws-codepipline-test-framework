data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "postman_bucket" {
  statement {
    principals {
      type        = "AWS"
      identifiers = ["${aws_iam_role.test_framework.arn}"]
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