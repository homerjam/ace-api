# ACE API

RESTish API module used by ACE projects

### Documentation

Documentation is currently a work in progress.

http://petstore.swagger.io/?url=https://rawgit.com/StudioThomas/ace-api/master/docs/api.json#/

### Environment Variables

    # The database used during authorisation to map users to agents
    AUTH_DB_NAME=

    # The database(s) of agents we wish to push design docs to (comma separated)
    AGENT_DB_NAME=

    # TESTING ONLY

    PORT=5000

    ENVIRONMENT=development|testing|production
    DEBUG=false # Change to nano etc
    CACHE=false

    DB_NAME=
    DB_URL=

    SESSION_SECRET=
    AUTH_TOKEN_SECRET=

    DEV_EMAIL=
    DEV_SLUG=
    DEV_DB_NAME=
    DEV_ROLE=admin
    DEV_SUPER=true

### Useful

    # Heroku rebuild (similar to rm -rf node_modules locally)
    $ heroku repo:purge_cache -a appname && \
        git commit --allow-empty -m "rebuild" && \
        git push heroku master
