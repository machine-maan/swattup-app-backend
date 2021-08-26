const configHelper = require("./configHelper");

module.exports = (request) => {
    var rUrl = request.protocol + '://' + request.get('host') + request.originalUrl;
    var limit = parseInt(request.query.limit) || configHelper.PAGINATION_DATA_LIMIT;
    var page = request.query.page ? parseInt(request.query.page) : 1;

    return {
        aggregateQuery: () => {
            return [
                {
                    $skip: (limit * (page - 1)),
                },
                {
                    $limit: limit,
                },
            ];
        },
        getTotalDataByModal: async (modal, query) => {
            let countQuery = modal.aggregate([
                ...query,
                {
                    $count: 'count',
                },
            ]);
        
            return await countQuery.then((result) => {
                return result ? (result.length ? result[0].count : null) : null;
            });
        },
        metadata: (totalData = null) => {
            console.log('totalData...', totalData);
            let nextPage = null;
            if (totalData && (page * limit) < totalData) {
                nextPage = new URL(rUrl);
                nextPage.searchParams.delete('page');
                nextPage.searchParams.append('page', page + 1);
            }
            let previousPage = null;
            if (page > 1) {
                previousPage = new URL(rUrl);
                previousPage.searchParams.delete('page');
                previousPage.searchParams.append('page', page - 1);
            }
    
            return {
                page: page,
                limit: limit,
                totalData: totalData,
                currentPage: rUrl,
                nextPage: nextPage,
                previousPage: previousPage,
            };
        },
    }
}