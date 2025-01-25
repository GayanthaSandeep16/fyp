exports.successResponse = (res, data, status = 200) => {
    res.status(status).json({
        success: true,
        ...data
    });
};

exports.errorResponse = (res, message, status = 400) => {
    res.status(status).json({
        success: false,
        error: message
    });
};