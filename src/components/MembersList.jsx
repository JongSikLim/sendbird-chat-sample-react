const MembersList = ({
  toggleMembersList,
  isShowMembersList,
  users,
  registerUnregisterAnOperator,
  userIdInputValue,
  operators,
  handleSortMembers,
}) => {
  if (isShowMembersList && users) {
      return (
          <div className="members-list">
              <button onClick={toggleMembersList}>Close</button>
              <div>
                  <select onChange={(event) => handleSortMembers(event)}>
                      <option value="all">All users</option>
                      <option value="member_nickname_alphabetical">
                          Alphabetical order
                      </option>
                      <option value="operator_then_member_alphabetical">
                          Operators first, alphabetical order
                      </option>
                  </select>
              </div>
              {users.map((user) => {
                  const isOperator = operators.find(
                      (operator) =>
                          user.userId === operator.userId.substr(0, 2)
                  )
                  const userIsNotSender = user.userId !== userIdInputValue
                  return (
                      <div key={user.userId}>
                          <div
                              key={user.userId}
                              className="member-item-wrapper"
                          >
                              <div className="member-item">
                                  {user.nickname}
                                  {isOperator && (
                                      <img
                                          className="message-icon"
                                          src="/operator_icon.png"
                                      />
                                  )}
                              </div>
                              {userIsNotSender && (
                                  <button
                                      onClick={() =>
                                          registerUnregisterAnOperator(
                                              user,
                                              isOperator
                                          )
                                      }
                                  >
                                      {isOperator
                                          ? 'Unregister as operator'
                                          : 'Register as operator'}
                                  </button>
                              )}
                          </div>
                      </div>
                  )
              })}
          </div>
      )
  } else {
      return null
  }
}

export default MembersList;