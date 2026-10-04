// Waits until a container's HEALTHCHECK (from its Dockerfile) reports "healthy"
def waitHealthy(String name) {
  sh """
    for i in \$(seq 1 60); do
      status=\$(docker inspect -f '{{.State.Health.Status}}' ${name})
      echo "${name}: \$status"
      if [ "\$status" = "healthy" ]; then exit 0; fi
      sleep 3
    done
    echo "${name} never became healthy"
    docker logs --tail 50 ${name}
    exit 1
  """
}

pipeline {
  agent any
  tools { nodejs 'node20' }

  options {
    disableConcurrentBuilds()          // container names below are fixed
    timeout(time: 30, unit: 'MINUTES')
  }

  triggers { pollSCM('H/2 * * * *') }

  environment {
    TAG              = "${env.BUILD_NUMBER}"           // release version, only created after all tests pass
    DB_ROOT_PASSWORD = 'rootpass'
    DB_PASSWORD      = 'apppass'
  }

  stages {

    stage('Install') {
      steps {
        dir('server') { sh 'npm install' }
        dir('client') { sh 'npm install' }
      }
    }

    stage('Unit Test') {
      steps {
        dir('server') { sh 'npm test' }
        dir('client') { sh 'npm test' }
      }
    }

    stage('Build Image') {
      steps {
        // "candidate" = built but not yet proven. Overwritten on every build.
        sh '''
          docker build -t evt-db:candidate ./db
          docker build -t evt-server:candidate ./server
          docker build -t evt-web:candidate ./client
        '''
      }
    }

    stage('Start test stack') {
      steps {
        sh '''
          docker rm -f evt-ci-web evt-ci-server evt-ci-db || true
          docker network rm evt-test-net || true
          docker network create evt-test-net
          docker run -d --name evt-ci-db --network evt-test-net --network-alias db \
            -e MYSQL_ROOT_PASSWORD=$DB_ROOT_PASSWORD -e MYSQL_DATABASE=events \
            -e MYSQL_USER=app -e MYSQL_PASSWORD=$DB_PASSWORD evt-db:candidate
        '''
        waitHealthy('evt-ci-db')
        sh '''
          docker run -d --name evt-ci-server --network evt-test-net --network-alias server \
            -e DB_HOST=db -e DB_NAME=events -e DB_USER=app -e DB_PASSWORD=$DB_PASSWORD \
            evt-server:candidate
        '''
        waitHealthy('evt-ci-server')
        sh '''
          docker run -d --name evt-ci-web --network evt-test-net evt-web:candidate
          docker network connect ci-network evt-ci-web   # lets Jenkins reach it for the Health checks stage
        '''
        waitHealthy('evt-ci-web')
      }
    }

    stage('Health checks') {
      steps {
        retry(3) {
          sh '''
            curl -fsS http://evt-ci-web/healthz; echo
            curl -fsS http://evt-ci-web/api/health; echo
          '''
        }
      }
    }

    stage('Deploy') {
      when { expression { env.GIT_BRANCH ==~ /(origin\/)?main/ } }
      steps {
        // Everything above passed -> promote the tested images to a numbered release
        sh '''
          docker tag evt-db:candidate     evt-db:$TAG
          docker tag evt-server:candidate evt-server:$TAG
          docker tag evt-web:candidate    evt-web:$TAG
        '''
        sh '''
          docker network create evt-net || true
          docker rm -f evt-web evt-server evt-db || true
          docker run -d --name evt-db --restart unless-stopped --network evt-net --network-alias db \
            -v evt-db-data:/var/lib/mysql \
            -e MYSQL_ROOT_PASSWORD=$DB_ROOT_PASSWORD -e MYSQL_DATABASE=events \
            -e MYSQL_USER=app -e MYSQL_PASSWORD=$DB_PASSWORD evt-db:$TAG
        '''
        waitHealthy('evt-db')
        sh '''
          docker run -d --name evt-server --restart unless-stopped --network evt-net --network-alias server \
            -e DB_HOST=db -e DB_NAME=events -e DB_USER=app -e DB_PASSWORD=$DB_PASSWORD \
            evt-server:$TAG
        '''
        waitHealthy('evt-server')
        sh 'docker run -d --name evt-web --restart unless-stopped --network evt-net -p 4000:80 evt-web:$TAG'
        waitHealthy('evt-web')
        retry(5) {
          sleep time: 5, unit: 'SECONDS'
                    sh 'docker exec evt-web wget -qO- http://127.0.0.1/api/health'
        }
        // Keep only the 3 newest release versions of each image
        sh '''
          for img in evt-db evt-server evt-web; do
            docker images $img --format '{{.Tag}}' | grep -E '^[0-9]+$' | sort -rn | tail -n +4 | while read t; do
              docker rmi $img:$t || true
            done
          done
        '''
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'server/reports/junit.xml,client/reports/junit.xml'
      sh '''
        docker logs evt-ci-db     > ci-db.log     2>&1 || true
        docker logs evt-ci-server > ci-server.log 2>&1 || true
        docker logs evt-ci-web    > ci-web.log    2>&1 || true
      '''
      archiveArtifacts artifacts: 'ci-*.log', allowEmptyArchive: true
      sh '''
        docker rm -f evt-ci-web evt-ci-server evt-ci-db || true
        docker network rm evt-test-net || true
        docker image prune -f || true
      '''
    }
  }
}