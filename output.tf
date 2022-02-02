output "TestReport" {
    value = aws_codebuild_report_group.TestReport
}

output "CodeCoverageReport" {
    value = aws_codebuild_report_group.CodeCoverageReport
}
output "IntegrationTestReport" {
    value = aws_codebuild_report_group.IntegrationTestReport
}