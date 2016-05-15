var assert = require('chai').assert;
var nock = require('nock');

describe('the s3 resource', function () {
  var subject = require('../lib/s3');

  describe('the #filterEvent method', function () {
    describe('bucket matching', function () {
      describe('when it does not match', function () {
        it('fails', function () {
          assert.isFalse(subject.filterEvent(
            {
              bucket: "test-bucket-name"
            },
            {
              bucket: "test-other-bucket-name"
            }
          ));
        });
      });

      describe('when it does match', function () {
        it('succeeds', function () {
          assert.isTrue(subject.filterEvent(
            {
              bucket: "test-bucket-name"
            },
            {
              bucket: "test-bucket-name"
            }
          ));
        });
      });
    });

    describe('key matching', function () {
      describe('when it does not match', function () {
        it('fails', function () {
          assert.isFalse(subject.filterEvent(
            {
              bucket: "test-bucket-name",
              path: "actual/otherfile"
            },
            {
              bucket: "test-bucket-name",
              key: "actual/file/path.tgz"
            }
          ));
        });
      });

      describe('when it does match', function () {
        it('succeeds', function () {
          assert.isTrue(subject.filterEvent(
            {
              bucket: "test-bucket-name",
              path: "actual/file"
            },
            {
              bucket: "test-bucket-name",
              key: "actual/file/path.tgz"
            }
          ));
        });
      });
    });
  });

  describe('#handleNotificationLambda', function () {
    describe('a write event', function () {
      describe('pipeline notifications', function () {
        describe('simple check', function () {
          it('notifies atc', function (done) {
            nock.disableNetConnect()
            nock('http://localhost')
              .post('/api/v1/pipelines/test-pipeline/resources/test-check/check', {})
              .reply(200, {})
              ;

            subject.handleNotificationLambda(
              {
                Records: [
                  {
                    s3: {
                      bucket: {
                        name: "test-bucket-name"
                      },
                      object: {
                        key: "some/file/path/exists.tgz"
                      }
                    }
                  }
                ],
                config: {
                  atc: {
                    url: "http://localhost",
                    headers: {
                      authorization: 'Basic Y29uY291cnNlOmNvbmNvdXJzZQ=='
                    }
                  },
                  checks: [
                    {
                      check: "test-pipeline/test-check",
                      filter: {
                        bucket: "test-bucket-name",
                        path: "some/file/path"
                      }
                    }
                  ]
                }
              },
              null,
              function (error, result) {
                assert.isNull(error);
                assert.equal(result.status, "ok");
                assert.equal(result.message, "resources notified");
                assert.lengthOf(result.checks.success, 1);
                assert.lengthOf(result.checks.failure, 0);
                done();
              }
            );
          });
        });
        
        describe('multiple checks', function () {
          it('notifies atc', function (done) {
            nock.disableNetConnect()
            nock('http://localhost')
              .post('/api/v1/pipelines/test-pipeline/resources/test-check/check', {})
              .reply(200, {})
              .post('/api/v1/pipelines/test-pipeline/resources/other-check/check', {})
              .reply(200, {})
              .post('/api/v1/pipelines/test-pipeline/resources/nonexistant-check/check', {})
              .reply(500, {})
              ;

            subject.handleNotificationLambda(
              {
                Records: [
                  {
                    s3: {
                      bucket: {
                        name: "test-bucket-name"
                      },
                      object: {
                        key: "some/file/path/exists.tgz"
                      }
                    }
                  }
                ],
                config: {
                  atc: {
                    url: "http://localhost",
                    headers: {
                      authorization: 'Basic Y29uY291cnNlOmNvbmNvdXJzZQ=='
                    }
                  },
                  checks: [
                    {
                      check: "test-pipeline/test-check",
                      filter: {
                        bucket: "test-bucket-name",
                        path: "some/file/path"
                      }
                    },
                    {
                      check: "test-pipeline/other-check",
                      filter: {
                        bucket: "test-bucket-name",
                        path: "some/file/path"
                      }
                    },
                    {
                      check: "test-pipeline/nonexistant-check",
                      filter: {
                        bucket: "test-bucket-name",
                        path: "some/file/path"
                      }
                    }
                  ]
                }
              },
              null,
              function (error, result) {
                assert.isNull(error);
                assert.equal(result.status, "ok");
                assert.equal(result.message, "resources notified");
                assert.lengthOf(result.checks.success, 2);
                assert.lengthOf(result.checks.failure, 1);
                done();
              }
            );
          });
        });
      });
    });
  
    describe('for unrecognized repositories', function () {
      it('exits cleanly', function (done) {
        subject.handleNotificationLambda(
          {
            Records: [
              {
                s3: {
                  bucket: {
                    name: "test-bucket-name"
                  },
                  object: {
                    key: "some/file/path/exists.tgz"
                  }
                }
              }
            ],
            config: {
              atc: {
                url: "http://localhost",
                headers: {}
              },
              checks: []
            }
          },
          null,
          function (error, result) {
            assert.isNull(error);
            assert.equal(result.status, "ok");
            assert.equal(result.message, "resources notified");
            assert.lengthOf(result.checks.success, 0);
            assert.lengthOf(result.checks.failure, 0);
            done();
          }
        );
      });
    });
  });
});
