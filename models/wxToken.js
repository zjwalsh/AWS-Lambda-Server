/**
 * Stores the definition of a Token in the database.
 * Although the example using SQLite, you can swap this with any database of your choice.
 * The token definition defines how you store this in your database.
 * You may also choose to "refresh" just before the "expires_in" - it depends on the implementation.
 */

const { DataTypes } = require('sequelize');
const { db } = require('../public/javascripts/db/db');

// This defines the way we store the Token on the database.
const wxToken = db.define(
  'wxtokens',
  {
    // Model attributes are defined here
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },  
    access_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expires_in: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    refresh_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    refresh_token_expires_in: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    token_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    scope: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    // Other model options go here
    timestamps: true,
    underscored: false,
  }
);

module.exports = { wxToken };