export const successResponse = (res, data, status = 200) => {
    res.status(status).json({
        success: true,
        ...data
    });
};

export const errorResponse = (res, message, status = 403) => {
    res.status(status).json({
        success: false,
        error: message
    });
};
