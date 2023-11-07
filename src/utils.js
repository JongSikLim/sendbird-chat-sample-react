const getAllApplicationUsers = async (sb) => {
  try {
    const userQuery = sb.createApplicationUserListQuery({ limit: 100 });
    const users = await userQuery.next();
    return [users, null];
  } catch (error) {
    return [null, error];
  }
};

const getChannelOperators = async (channel) => {
  try {
    const query = channel.createOperatorListQuery();
    const operators = await query.next();
    return [operators, null];
  } catch (error) {
    return [null, error];
  }
};

const sortUsersAlphabetical = (array) => {
  const result = array.sort((a, b) => {
    let nicknameA = a.nickname.toLowerCase();
    let nicknameB = b.nickname.toLowerCase();

    if (nicknameA < nicknameB) {
      return -1;
    }

    if (nicknameA > nicknameB) {
      return 1;
    }

    return 0;
  });

  return result;
};

export { getAllApplicationUsers, getChannelOperators, sortUsersAlphabetical };
