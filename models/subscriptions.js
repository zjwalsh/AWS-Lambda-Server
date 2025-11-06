const { DataTypes } = require('sequelize');
const { db } = require('../public/javascripts/db/db');

// This defines the way we store the Token on the database.
const subscriptions = db.define(
  'subscriptions',
  {
    
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    evenTypes: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    destinationUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdTime: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    underscored: false,
  }
);

module.exports = { subscriptions };