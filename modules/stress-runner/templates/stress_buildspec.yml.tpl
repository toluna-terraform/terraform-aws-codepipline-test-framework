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
        echo '
        <?xml version="1.0"?>
        <xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
          <xsl:output method="xml" indent="yes" encoding="UTF-8"/>
          <xsl:template match="/testResults">
            <testsuites>
              <testsuite>
                <xsl:for-each select="*">
                  <testcase>
                    <xsl:attribute name="classname"><xsl:value-of select="name()"/></xsl:attribute>
                    <xsl:attribute name="name"><xsl:value-of select="@lb"/></xsl:attribute>
                    <xsl:attribute name="time"><xsl:value-of select="@lt div 1000"/></xsl:attribute>
                    <xsl:if test="assertionResult/failureMessage">
                      <failure><xsl:value-of select="assertionResult/failureMessage"/></failure>
                    </xsl:if>
                    <xsl:if test="@s = 'false'">
                      <xsl:if test="responseData">
                        <error><xsl:value-of select="responseData"/></error>
                      </xsl:if>
                    </xsl:if>
                  </testcase>
                </xsl:for-each>
              </testsuite>
            </testsuites>
          </xsl:template>
        </xsl:stylesheet>
        ' > jtl2junit.xsl
  build:
    commands:
        - #add aws cli to retrive BASE_URL
        - $JMETER_HOME/bin/jmeter -n -t ${jmx_file_path} -JbaseUrl=$BASE_URL -Jtest_name=${app_name}-${env_type}.xml
  post_build:
    commands:
      - xsltproc -o report.xml jtl2junit.xsl ${app_name}-${env_type}.xml
reports:
  $REPORT_GROUP:
    files:
      - 'report.xml'
    file-format: JunitXml    