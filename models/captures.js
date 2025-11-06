/**
 * Stores the definition of a Token in the database.
 * Although the example using SQLite, you can swap this with any database of your choice.
 * The token definition defines how you store this in your database.
 * You may also choose to "refresh" just before the "expires_in" - it depends on the implementation.
 */

const { DataTypes } = require('sequelize');
const { db } = require('../public/javascripts/db/db');

// This defines the way we store the Token on the database.
const wxCaptures = db.define(
  'captures',
  {
    // Model attributes are defined here
    taskId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    // Model attributes are defined here
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Model attributes are defined here
    recordingURL: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    startTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    participantANI: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    participantId: {
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

module.exports = { wxCaptures };