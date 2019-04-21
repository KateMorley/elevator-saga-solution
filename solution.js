{

  init : function(elevators, floors){

    const UP   = 0
    const DOWN = 1

    const PASS = 0
    const STOP = 1
    const TURN = 2

    const TOP_FLOOR = Math.max(...floors.map(floor => floor.floorNum()))

    let waiting = [new Set(), new Set()]

    floors.forEach(floor => {
      floor.on('up_button_pressed',   () => setWaiting(floor.floorNum(), UP))
      floor.on('down_button_pressed', () => setWaiting(floor.floorNum(), DOWN))
    })

    elevators.forEach(elevator => {

      elevator.stops = new Set()

      elevator.on('floor_button_pressed', floor => elevator.stops.add(floor))
      elevator.on('passing_floor', floor => handleApproach(elevator, floor))
      elevator.on('stopped_at_floor', floor => handleStop(elevator, floor))

    })

    // Sets that people are waiting on a floor. The parameters are:
    //
    // floor     - the floor
    // direction - the direction
    function setWaiting(floor, direction){

      waiting[direction].add(floor)

      if (floor === 0){
        return
      }

      let idle = elevators.find(elevator => (elevator.direction === undefined))
      if (idle){
        handleStop(idle, 0)
      }

    }

    // Clears that people are waiting on a floor. The parameters are:
    //
    // floor     - the floor
    // direction - the direction
    function clearWaiting(floor, direction){
      waiting[direction].delete(floor)
    }

    // Returns whether people are waiting on a floor.  The parameters are:
    //
    // floor     - the floor
    // direction - the direction
    function hasWaiting(floor, direction){
      return waiting[direction].has(floor)
    }

    // Returns whether people are waiting above a floor. The parameters are:
    //
    // floor     - the floor
    // direction - the direction
    function hasWaitingAbove(floor, direction){
      return Math.max(...waiting[direction]) > floor
    }

    // Returns whether people are waiting past a floor. The parameters are:
    //
    // floor     - the floor
    // direction - the direction in which to look
    function hasWaitingPast(floor, direction){
      if (direction === UP){
        return Math.max(...waiting[UP], ...waiting[DOWN]) > floor
      }else{
        return Math.min(...waiting[UP], ...waiting[DOWN]) < floor
      }
    }

    // Handles an elevator approaching a floor. The parameters are:
    //
    // elevator - the elevator
    // floor    - the floor being approached
    function handleApproach(elevator, floor){

      switch (getAction(elevator, floor)){

        case STOP:
          elevator.goToFloor(floor, true)
          updateDirection(elevator, floor)
          break

        case TURN:
          elevator.direction = getOppositeDirection(elevator)
          applyDirection(elevator)
          break

      }

    }

    // Returns whether an elevator should pass the next floor, stop at it, or
    // immediately turn. The parameters are:
    //
    // elevator - the elevator
    // floor    - the floor being approached
    function getAction(elevator, floor){

      if (elevator.stops.has(floor)){
        return STOP
      }

      if (elevator.maxPassengerCount() * (1 - elevator.loadFactor()) < 1){
        return PASS
      }

      if (hasWaiting(floor, elevator.direction)
          && !isStop(floor, elevator.direction)){
        return STOP
      }

      if (elevator.stops.size > 0 || isNeededBeyondFloor(elevator, floor)){
        return PASS
      }

      if (hasWaiting(floor, getOppositeDirection(elevator))
          && !isStop(floor, getOppositeDirection(elevator))){
        return STOP
      }

      return TURN

    }

    // Returns whether a floor is already a planned stop for any elevator. The
    // parameters are:
    //
    // floor     - the floor
    // direction - the direction
    function isStop(floor, direction){
      return elevators.some(
          elevator =>
              elevator.direction === direction && elevator.stops.has(floor))
    }

    // Handles an elevator stopping. The parameters are:
    //
    // elevator - the elevator
    // floor    - the floor stopped at
    function handleStop(elevator, floor){

      if (floor === 0 || floor === TOP_FLOOR){
        updateDirection(elevator, floor)
      }

      applyDirection(elevator)

    }

    // Updates an elevator's direction. The parameters are:
    //
    // elevator - the elevator
    // floor    - the floor stopped at
    function updateDirection(elevator, floor){

      elevator.stops.delete(floor)

      if (floor === 0){
        elevator.direction = UP
      }else if (floor === TOP_FLOOR){
        elevator.direction = DOWN
      }else if (elevator.stops.size > 0){
        // continue
      }else if (hasWaiting(floor, elevator.direction)){
        // continue
      }else if (!isNeededBeyondFloor(elevator, floor)){
        elevator.direction = getOppositeDirection(elevator)
      }

      clearWaiting(floor, elevator.direction)

    }

    // Returns whether an elevator is needed in the current direction. The
    // parameters are:
    //
    // elevator - the elevator
    // floor    - the floor being approached
    function isNeededBeyondFloor(elevator, floor){

      if (!hasWaitingPast(floor, elevator.direction)){
        return false
      }

      if (elevator.direction === DOWN){
        return true
      }

      if (hasWaitingAbove(floor, UP)){
        return true
      }

      if (getHighestElevator(UP) !== elevator){
        return false
      }

      let highestDownElevator = getHighestElevator(DOWN)
      if (highestDownElevator
          && !hasWaitingAbove(highestDownElevator.currentFloor() - 1, DOWN)){
        return false
      }

      return true

    }

    // Returns the highets elevator heading in a direction. The parameter is:
    //
    // direction - the direction
    function getHighestElevator(direction){

      let highest = null
      let floor   = 0

      elevators.forEach(elevator => {

        if (elevator.direction === direction
            && elevator.currentFloor() > floor){
          highest = elevator
          floor   = elevator.currentFloor()
        }

      })

      return highest

    }

    // Sets an elevator moving in its next direction.  The parameter is:
    //
    // elevator - the elevator
    function applyDirection(elevator){

      elevator.goingUpIndicator(elevator.direction === UP)
      elevator.goingDownIndicator(elevator.direction === DOWN)

      elevator.destinationQueue = [(elevator.direction === UP ? TOP_FLOOR : 0)]
      elevator.checkDestinationQueue()

    }

    // Returns the opposite direction for an elevator. The parameter is:
    //
    // elevator - the elevator
    function getOppositeDirection(elevator){
      return (elevator.direction === UP ? DOWN : UP)
    }

  },

  update : function(dt, elevators, floors){
  }

}
