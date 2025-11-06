/**
 * Stores the definition of a Token in the database.
 * Although the example using SQLite, you can swap this with any database of your choice.
 * The token definition defines how you store this in your database.
 * You may also choose to "refresh" just before the "expires_in" - it depends on the implementation.
 */

const { DataTypes } = require('sequelize');
const { db } = require('../public/javascripts/db/db');

// This defines the way we store the Token on the database.
const calToken = db.define(
  'caltokens',
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey:true,
    },
    // Model attributes are defined here
    access_token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Model attributes are defined here
   scope: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Model attributes are defined here
    token_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expires_in: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
  },
  {
    // Other model options go here
    timestamps: true,
    underscored: false,
  }
);

module.exports = { calToken };