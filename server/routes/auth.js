module.exports = async ({
  Auth,
  router,
  asyncMiddleware,
  getAppConfig,
  handleResponse,
  handleError,
}) => {
  const auth = Auth(await getAppConfig());

  router.get(
    '/auth/user.:ext?',
    auth.jwtCheck,
    asyncMiddleware(async (req, res) => {
      try {
        const authUser = await auth.authUser(
          req.query.slug,
          req.headers.authorization.split(' ')[1]
        );

        handleResponse(req, res, authUser);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
