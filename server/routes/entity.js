const isArray = require('lodash/isArray');

module.exports = ({
  Db,
  Entity,
  router,
  authMiddleware,
  permissionMiddleware,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  /**
   * @swagger
   * definitions:
   *  Entity:
   *    type: object
   *    required:
   *      - _id
   *      - _rev
   *    properties:
   *      _id:
   *        type: string
   *      _rev:
   *        type: string
   *      schema:
   *        type: string
   *      title:
   *        type: string
   *      slug:
   *        type: string
   *      thumbnail:
   *        type: object
   *      fields:
   *        type: object
   *      published:
   *        type: boolean
   *      publishedAt:
   *        type: string
   */

  /**
   * @swagger
   * /entities/index:
   *  get:
   *    tags:
   *      - entities
   *    summary: Show indexes
   *    description: Show all indexes, use this to find fields available for search/query.
   *    produces:
   *      - application/json
   *    parameters: []
   *    responses:
   *      200:
   *        description: Indexes
   */
  router.get(
    '/entities/index.:ext?',
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Db(await getConfig(req.session)).indexAsync()
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  /**
   * @swagger
   * /entities/search:
   *  get:
   *    tags:
   *      - entities
   *    summary: Search entities
   *    description: This endpoint extends Cloudant's Lucene based search. Learn more from Cloudant's [documentation](https://docs.cloudant.com/search.html).
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: query
   *        description: Lucene search query
   *        in: query
   *        required: true
   *        type: string
   *      - name: include_docs
   *        description: Include docs in search results (ignored if `children` or `parents` is `true`)
   *        in: query
   *        required: false
   *        type: boolean
   *        default: false
   *      - name: sort
   *        description: Field to sort results by. Prefixed with `-` to reverse order. Suffixed with &#60;`string|number`&#62;
   *        in: query
   *        required: false
   *        type: string
   *      - name: limit
   *        description: Limit results (max 200)
   *        in: query
   *        required: false
   *        type: number
   *      - name: bookmark
   *        description: Bookmark for the next page of results
   *        in: query
   *        required: false
   *        type: string
   *      - name: group_field
   *        description: Field to group results by
   *        in: query
   *        required: false
   *        type: string
   *      - name: index
   *        description: Search index
   *        in: query
   *        required: false
   *        type: string
   *        default: all
   *      - name: children
   *        description: Get child entities
   *        in: query
   *        required: false
   *        type: boolean
   *        default: false
   *      - name: parents
   *        description: Get parent entities
   *        in: query
   *        required: false
   *        type: boolean
   *        default: false
   *      - name: trashed
   *        description: Get trashed entities
   *        in: query
   *        required: false
   *        type: boolean
   *        default: false
   *    responses:
   *      200:
   *        description: Search result
   *        schema:
   *          type: object
   *          properties:
   *            bookmark:
   *              type: string
   *            total_rows:
   *              type: number
   *            rows:
   *              type: array
   *              items:
   *                $ref: '#/definitions/Entity'
   */
  router.all(
    '/entities/search?.:ext?',
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const input = Object.keys(req.body).length ? req.body : req.query;

      // eslint-disable-next-line
      const include_docs =
        input.include_docs !== undefined
          ? JSON.parse(input.include_docs)
          : false;

      // eslint-disable-next-line
      const include_fields =
        input.include_fields !== undefined
          ? typeof input.include_fields === 'object'
            ? input.include_fields
            : JSON.parse(input.include_fields)
          : [];

      const select = input.select !== undefined ? input.select : false;

      let children =
        input.children !== undefined
          ? typeof input.children === 'object'
            ? input.children
            : JSON.parse(input.children)
          : false;
      let parents =
        input.parents !== undefined
          ? typeof input.parents === 'object'
            ? input.parents
            : JSON.parse(input.parents)
          : false;

      if (children === true) {
        children = 1;
      }
      if (parents === true) {
        parents = 1;
      }

      const trashed =
        input.trashed !== undefined ? JSON.parse(input.trashed) : false;

      const sort = input.sort !== undefined ? input.sort : null;
      const limit =
        input.limit !== undefined ? parseInt(input.limit, 10) : null;

      const bookmark = input.bookmark !== undefined ? input.bookmark : null;

      // eslint-disable-next-line
      const group_field =
        input.group_field !== undefined ? input.group_field : null;

      const index = input.index !== undefined ? input.index : null;

      const q = input.query || input.q;

      let query = [];

      query.push(trashed ? 'trashed:true' : '!trashed:true');

      if (req.session.role === 'guest') {
        query.push('published:true');
      }

      if (q) {
        query.push(`(${q})`);
      }

      query = query.join(' AND ');

      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.entitySearch(
            {
              query,
              include_docs,
              include_fields,
              sort,
              limit,
              bookmark,
              group_field,
              index,
            },
            {
              select,
              children,
              parents,
              role: req.session.role,
            }
          ),
          true
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  /**
   * @swagger
   * /entities/find:
   *  get:
   *    tags:
   *      - entities
   *    summary: Query entities
   *    description: This endpoint extends CouchDB's Mango query. Learn more from Cloudant's [documentation](https://docs.cloudant.com/cloudant_query.html#finding-documents-using-an-index).
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: query
   *        description: JSON query object, refer to CouchDB/Cloudant docs.
   *        in: query
   *        required: true
   *        type: string
   *      - name: children
   *        description: Get child entities
   *        in: query
   *        required: false
   *        type: boolean
   *        default: false
   *      - name: parents
   *        description: Get parent entities
   *        in: query
   *        required: false
   *        type: boolean
   *        default: false
   *    responses:
   *      200:
   *        description: Query result
   *        schema:
   *          type: object
   *          properties:
   *            bookmark:
   *              type: string
   *            docs:
   *              type: array
   *              items:
   *                $ref: '#/definitions/Entity'
   */
  router.all(
    '/entities/find.:ext?',
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const input = Object.keys(req.body).length ? req.body : req.query;

      let children =
        input.children !== undefined
          ? typeof input.children === 'object'
            ? input.children
            : JSON.parse(input.children)
          : false;
      let parents =
        input.parents !== undefined
          ? typeof input.parents === 'object'
            ? input.parents
            : JSON.parse(input.parents)
          : false;

      if (children === true) {
        children = 1;
      }
      if (parents === true) {
        parents = 1;
      }

      const trashed =
        input.trashed !== undefined ? JSON.parse(input.trashed) : false;

      const query = input.query ? JSON.parse(input.query) : { selector: {} };

      query.use_index = ['entityIndex', 'entity'];

      if (!query.selector.$and) {
        query.selector = {
          $and: [query.selector],
        };
      }

      if (trashed) {
        query.selector.$and.push({ trashed: true });
      } else {
        query.selector.$and.push({
          $or: [
            {
              trashed: {
                $exists: false,
              },
            },
            {
              trashed: false,
            },
          ],
        });
      }

      if (req.session.role === 'guest') {
        query.selector.$and.push({ published: true });
      }

      if (req.query.limit) {
        query.limit = parseInt(req.query.limit, 10);
      }

      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.entityFind(query, {
            children,
            parents,
            role: req.session.role,
          }),
          true
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/entities/field.:ext?',
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.fieldValues(
            req.query.slug || req.query.fieldSlug,
            req.query.searchTerm
          ),
          true
        );
      } catch (error) {
        handleError(res, error);
      }
    })
  );

  /**
   * @swagger
   * /entities:
   *  get:
   *    tags:
   *      - entities
   *    summary: Get all entities
   *    description: Get all entities, optionally from an array of IDs
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: id
   *        description: Entity ID
   *        in: query
   *        required: false
   *        type: string
   *      - name: ids
   *        description: Entity IDs
   *        in: query
   *        required: false
   *        type: array
   *        items:
   *          type: string
   *      - name: select
   *        description: Select fields via json query
   *        in: query
   *        required: false
   *        type: string
   *      - name: children
   *        description: Get child entities
   *        in: query
   *        required: false
   *        type: boolean | number | array
   *        default: false
   *      - name: parents
   *        description: Get parent entities
   *        in: query
   *        required: false
   *        type: boolean | number | array
   *        default: false
   *    responses:
   *      200:
   *        description: Entities
   *        schema:
   *          type: array
   *          items:
   *            $ref: '#/definitions/Entity'
   */
  router.all(
    '/entities.:ext?',
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const input = Object.keys(req.body).length ? req.body : req.query;

      const select = input.select !== undefined ? input.select : false;

      let children =
        input.children !== undefined
          ? typeof input.children === 'object'
            ? input.children
            : JSON.parse(input.children)
          : false;
      let parents =
        input.parents !== undefined
          ? typeof input.parents === 'object'
            ? input.parents
            : JSON.parse(input.parents)
          : false;

      if (children === true) {
        children = 1;
      }
      if (parents === true) {
        parents = 1;
      }

      let ids = input.ids || input.id;

      if (ids) {
        ids = isArray(ids) ? ids : [ids];
      }

      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.entityList(ids, {
            select,
            children,
            parents,
            role: req.session.role,
          }),
          true
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/entity/revisions.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'entityRead'),
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(req, res, await entity.entityRevisions(req.query.id));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/entity.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'entityCreate'),
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.entityCreate(req.body.entity || req.body.entities)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/entity.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'entityRead'),
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(req, res, await entity.entityRead(req.query.id));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/entity.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'entityUpdate'),
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.entityUpdate(
            req.body.entity || req.body.entities,
            req.body.restore || false
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/entity.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'entityDelete'),
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await entity.entityDelete(
            req.body.entity || req.body.entities,
            req.body.forever || false
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/entity/trashed.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'entityDelete'),
    asyncMiddleware(async (req, res) => {
      const entity = Entity(await getConfig(req.session));

      try {
        handleResponse(req, res, await entity.entityDelete('trashed'));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
