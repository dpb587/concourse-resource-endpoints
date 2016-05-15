var assert = require('chai').assert;
var nock = require('nock');

describe('the git resource', function () {
  describe('the github provider', function () {
    var subject = require('../lib/git/github');

    describe('the #filterPayload method', function () {
      describe('url matching', function () {
        describe('when it does not match', function () {
          it('fails', function () {
            assert.isFalse(subject.filterPayload(
              {
                uri: "https://github.com/example/other"
              },
              {
                repository: {
                  url: "https://github.com/example/subject"
                }
              }
            ));
          });
        });

        describe('when it does match', function () {
          it('succeeds', function () {
            assert.isTrue(subject.filterPayload(
              {
                uri: "https://github.com/example/subject"
              },
              {
                repository: {
                  url: "https://github.com/example/subject"
                }
              }
            ));
          });
        });
      });

      describe('branch matching', function () {
        describe('when it does not match', function () {
          it('fails', function () {
            assert.isFalse(subject.filterPayload(
              {
                uri: "https://github.com/example/subject",
                branch: "master"
              },
              {
                ref: "refs/heads/develop",
                repository: {
                  url: "https://github.com/example/subject"
                }
              }
            ));
          });
        });

        describe('when it does match', function () {
          it('succeeds', function () {
            assert.isTrue(subject.filterPayload(
              {
                uri: "https://github.com/example/subject",
                branch: "develop"
              },
              {
                ref: "refs/heads/develop",
                repository: {
                  url: "https://github.com/example/subject"
                }
              }
            ));
          });
        });
      });

      describe('paths matching', function () {
        describe('when it does not match', function () {
          it('does not trigger', function () {
            assert.isFalse(subject.filterPayload(
              {
                uri: "https://github.com/example/subject",
                branch: "develop",
                paths: [
                  "ci/something"
                ]
              },
              {
                ref: "refs/heads/develop",
                repository: {
                  url: "https://github.com/example/subject"
                },
                commits: [
                  {
                    added: [],
                    removed: [],
                    modified: [
                      "ci/docker/image/Dockerfile"
                    ]
                  }
                ]
              }
            ));
          });
        });

        describe('when it does match', function () {
          it('triggers', function () {
            assert.isTrue(subject.filterPayload(
              {
                uri: "https://github.com/example/subject",
                branch: "develop",
                paths: [
                  "ci/docker"
                ]
              },
              {
                ref: "refs/heads/develop",
                repository: {
                  url: "https://github.com/example/subject"
                },
                commits: [
                  {
                    added: [],
                    removed: [],
                    modified: [
                      "ci/docker/image/Dockerfile"
                    ]
                  }
                ]
              }
            ));
          });
        });
      });

      describe('ignore_paths matching', function () {
        describe('when commit path does not match', function () {
          it('triggers', function () {
            assert.isTrue(subject.filterPayload(
              {
                uri: "https://github.com/example/subject",
                branch: "develop",
                ignore_paths: [
                  "ci/something"
                ]
              },
              {
                ref: "refs/heads/develop",
                repository: {
                  url: "https://github.com/example/subject"
                },
                commits: [
                  {
                    added: [],
                    removed: [],
                    modified: [
                      "ci/docker/image/Dockerfile"
                    ]
                  }
                ]
              }
            ));
          });
        });

        describe('when commit path does match', function () {
          it('does not trigger', function () {
            assert.isFalse(subject.filterPayload(
              {
                uri: "https://github.com/example/subject",
                branch: "develop",
                ignore_paths: [
                  "ci/docker/**/*"
                ]
              },
              {
                ref: "refs/heads/develop",
                repository: {
                  url: "https://github.com/example/subject"
                },
                commits: [
                  {
                    added: [],
                    removed: [],
                    modified: [
                      "ci/docker/image/Dockerfile"
                    ]
                  }
                ]
              }
            ));
          });
        });
      });
    });

    describe('#handleWebhook', function () {
      describe('signature validation', function () {
        describe('an invalid signature', function () {
          it('errors', function (done) {
            subject.handleWebhook(
              {
                signature: 'invalid=signature',
                event: 'test',
                body: '{"sample":"data"}',
                config: {
                  secret: 'something-private'
                }
              },
              null,
              function (error, result) {
                assert.equal(error, 'incorrect signature: f12618ea99c7f1544afb30378c5e5af492dae582');
                assert.isUndefined(result);
                done();
              }
            );
          });
        });

        describe('a correct signature', function () {
          it('is allowed', function (done) {
            subject.handleWebhook(
              {
                signature: 'sha1=f12618ea99c7f1544afb30378c5e5af492dae582',
                event: 'test',
                body: '{"sample":"data"}',
                config: {
                  secret: 'something-private'
                }
              },
              null,
              function (error, result) {
                assert.isNull(error);
                assert.equal(result.status, "ok");
                assert.equal(result.message, "test event ignored");
                assert.lengthOf(result.checks.success, 0);
                assert.lengthOf(result.checks.failure, 0);
                done();
              }
            );
          });
        });

        describe('when secret is not configured', function () {
          it('ignores invalid signatures', function (done) {
            subject.handleWebhook(
              {
                signature: 'invalid=signature',
                event: 'test',
                body: '{"sample":"data"}'
              },
              null,
              function (error, result) {
                assert.isNull(error);
                assert.equal(result.status, "ok");
                assert.equal(result.message, "test event ignored");
                assert.lengthOf(result.checks.success, 0);
                assert.lengthOf(result.checks.failure, 0);
                done();
              }
            );
          });

          it('ignores missing signatures', function (done) {
            subject.handleWebhook(
              {
                event: 'test',
                body: '{"sample":"data"}'
              },
              null,
              function (error, result) {
                assert.isNull(error);
                assert.equal(result.status, "ok");
                assert.equal(result.message, "test event ignored");
                assert.lengthOf(result.checks.success, 0);
                assert.lengthOf(result.checks.failure, 0);
                done();
              }
            );
          });
        });
      });
    
      describe('event handling', function () {
        describe('a push event', function () {
          describe('configured repositories', function () {
            describe('pipeline notifications', function () {
              describe('simple check', function () {
                it('notifies atc', function (done) {
                  nock.disableNetConnect()
                  nock('http://localhost')
                    .post('/api/v1/pipelines/test-pipeline/resources/test-check/check', {})
                    .reply(200, {})
                    ;

                  subject.handleWebhook(
                    {
                      event: 'push',
                      body: '{"repository":{"url":"https://github.com/example/subject"}}',
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
                              uri: "https://github.com/example/subject"
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

                  subject.handleWebhook(
                    {
                      event: 'push',
                      body: '{"repository":{"url":"https://github.com/example/subject"}}',
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
                              uri: "https://github.com/example/subject"
                            }
                          },
                          {
                            check: "test-pipeline/other-check",
                            filter: {
                              uri: "https://github.com/example/subject"
                            }
                          },
                          {
                            check: "test-pipeline/nonexistant-check",
                            filter: {
                              uri: "https://github.com/example/subject"
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
              subject.handleWebhook(
                {
                  event: 'push',
                  body: '{"repository":{"url":"https://github.com/example/subject"}}',
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
      
        describe ('any other event type', function () {
          it('is ignored', function (done) {
            subject.handleWebhook(
              {
                event: 'test',
                body: '{"sample":"data"}'
              },
              null,
              function (error, result) {
                assert.isNull(error);
                assert.equal(result.status, "ok");
                assert.equal(result.message, "test event ignored");
                assert.lengthOf(result.checks.success, 0);
                assert.lengthOf(result.checks.failure, 0);
                done();
              }
            );
          });
        });
      });
    });
  });
});
