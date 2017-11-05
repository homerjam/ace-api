# ACE API

API module used by ACE projects

### Usage

Push design docs to your couchdb instance using `DB_URL` stored in `.env` file:

```
$ npm run design DB_NAME [DOC_NAME]
```

### Environment Variables

    PORT=5000

    ENVIRONMENT=development|testing|production
    DEBUG=false # Change to nano etc
    CACHE_ENABLED=false

    DB_NAME=
    DB_URL=

    SESSION_SECRET=
    AUTH_TOKEN_SECRET=

    DEV_USER_ID=
    DEV_SLUG=
    DEV_ROLE=
    DEV_EMAIL=

### Useful

    # Heroku rebuild (similar to rm -rf node_modules locally)
    $ heroku repo:purge_cache -a appname && \
        git commit --allow-empty -m "rebuild" && \
        git push heroku master

    # Push design documents to database
    $ source .env; node design $DB_URL $DB_NAME agent