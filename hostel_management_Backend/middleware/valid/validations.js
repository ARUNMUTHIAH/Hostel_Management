
import { check, validationResult } from 'express-validator';

const validateUserInput = [
    check('email').notEmpty().withMessage('Email is not Valid!').isEmail(),
    check('password')
      .notEmpty().withMessage('Password must be at least 4 digits!')
      .isLength({ min: 4 }),
  ];
  
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);  
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }  
    next();
  };

  export {validateUserInput ,handleValidationErrors}