version: 0.2

env:
  parameter-store:
    BB_USER: "/app/bb_user"  
    BB_PASS: "/app/bb_app_pass"
    CONSUL_PROJECT_ID: "/infra/${app_name}-${env_type}/consul_project_id"
    CONSUL_HTTP_TOKEN: "/infra/${app_name}-${env_type}/consul_http_token"

phases:
  pre_build:
    commands:
      - yum install -y yum-utils java-1.8.0-openjdk 
      - wget https://dlcdn.apache.org//jmeter/binaries/apache-jmeter-${jmeter_version}.tgz
      - tar -xf apache-jmeter-${jmeter_version}.tgz -C /root
      - echo "export JMETER_HOME=/root/apache-jmeter-${jmeter_version}" >> ~/.bashrc
      - echo "export PATH=$JMETER_HOME/bin:$PATH" >> ~/.bashrc
      - source ~/.bashrc
      - chmod +x -R /root/apache-jmeter-${jmeter_version}
      - $JMETER_HOME/bin/jmeter -v
      - | 
        tee -a jtl2junit.xsl <<EOF
        <?xml version="1.0"?>
        <xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
          <xsl:output method="xml" indent="yes" encoding="UTF-8"/>
          <xsl:template match="/testResults">
          <testsuites>
            <testsuite>
            <xsl:for-each select="*">
              <testcase>
              <xsl:attribute name="name"><xsl:value-of select="@lb"/></xsl:attribute>
              <xsl:attribute name="classname"><xsl:value-of select="@lb"/> / <xsl:value-of select="@tn"/></xsl:attribute>
              <xsl:attribute name="time"><xsl:value-of select="@lt div 1000"/></xsl:attribute>
              <xsl:if test="assertionResult/failureMessage">
                <failure><xsl:value-of select="assertionResult/failureMessage"/></failure>
              </xsl:if>
              <xsl:if test="@s = 'false'">
                <xsl:choose>
                <xsl:when test="responseData">
                <failure type="ERROR"><xsl:attribute name="message"><xsl:value-of select="responseData"/></xsl:attribute></failure>
                </xsl:when>
                <xsl:otherwise>
                <failure type="ERROR"><xsl:attribute name="message"><xsl:value-of select="@rc" /></xsl:attribute></failure>
                </xsl:otherwise>
              </xsl:choose>
              </xsl:if>
              </testcase>
            </xsl:for-each>
            </testsuite>
          </testsuites>
          </xsl:template>
        </xsl:stylesheet>
        EOF
  build:
    commands:
        - BASE_URL=$(aws elbv2 describe-load-balancers --name $LB_NAME --query 'LoadBalancers[0].DNSName' --output text)
        - $JMETER_HOME/bin/jmeter -n -t ${jmx_file_path} -JbaseURL=$BASE_URL -Jtest_name=/tmp/${app_name}-${env_type}
  post_build:
    commands:
      - xsltproc -o report.xml jtl2junit.xsl /tmp/${app_name}-${env_type}.xml
reports:
  $REPORT_GROUP:
    files:
      - 'report.xml'
    file-format: JunitXml    