module.exports = ({
  Shippo,
  router,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  router.all(
    '/shippo/quote.:ext?',
    asyncMiddleware(async (req, res) => {
      const shippo = Shippo(await getConfig());

      const address = req.body.address || JSON.parse(req.params.address);
      const parcel = req.body.parcel || JSON.parse(req.params.parcel);

      try {
        handleResponse(req, res, await shippo.getQuote(address, parcel), true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

};
