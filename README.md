# Kate Rose Morley’s Elevator Saga solution

[A solution](solution.js) for Magnus Wolffelt’s [Elevator Saga](https://play.elevatorsaga.com/).

## Aims

With multiple metrics to optimise — average waiting time, maximum waiting time, and the number of elevator moves — most solutions struggle on some challenges. This solution has been optimised for average waiting time on the [perpetual demo](https://play.elevatorsaga.com/#challenge=19), and achieves a long-term average waiting time of 11.8 seconds while keeping the maximum waiting time to around 40 seconds.

(Demonstrating the trade-offs involved in any solution, [Evgeniy Voronyuk’s solution](https://github.com/brunneng/elevatorsaga) achieves a better average waiting time of 10.8 seconds, but at the cost of a maximum waiting time of around 50 seconds.)

Uniquely, this solution explicitly aims to be educational, with a clearly structured algorithm accompanied by extensive documentation.

## Approach

There are three types of event within Elevator Saga:

- *Button events*, fired when someone presses a button, either to call an elevator to a floor where they are waiting or to request the elevator they are riding stops at their destination floor
- *Elevator events*, fired when an elevator is about to pass a floor or has stopped at a floor
- *Time events*, fired as game time passes

The floor and elevator objects allow listeners to be added for button and elevator events.

Time events are implemented through the required `update` method of the solution object, and are the only way to measure the passage of game time. A small number of solutions (such as Evgeniy’s, mentioned above) make use of time events to estimate waiting times, but doing so adds significant complexity, so this solution only uses button and elevator events.

This solution is *elevator-oriented*, in the sense that decisions are made in response to elevator events, while button events are only used to collect data for later use. It implements a form of shuttle: once an elevator starts moving it never becomes idle, and instead alternates between travelling up and down.

(In contrast, many solutions are *button-oriented*, in the sense that decisions are made in response to button events. These solutions usually involve each elevator being assigned a queue of destinations.)

## Algorithm

The algorithm consists of three parts:

- a starting policy, which determines when an elevator should start moving
- a stopping policy, which determines whether an elevator should stop at the next floor it approaches, continue past it, or immediately turn
- a turning policy, which determines which way an elevator should travel after stopping at a floor

The algorithm also uses a concept of whether an elevator is needed beyond a floor, which prevents elevators continuing to the top or bottom floor unnecessarily.

### Starting policy

The starting policy has no effect on long-term metrics, but improves performance on shorter levels by ensuring elevators don’t leave the bottom floor until needed elsewhere.

The policy consists of two parts:

1. If an elevator is idle and one of its buttons is pressed, start moving up
2. If a call button is pressed above the bottom floor and any elevators are idle, start the first idle elevator moving up

No code is required for the first part of the policy, as the `stopped_at_floor` event is fired when a button is pressed in an idle elevator, and this situation is handled by the turning policy.

### Stopping policy

As an elevator approaches a floor, the stopping policy is used to determine whether to stop, continue past the floor or immediately turn around. Note that the stopping policy is not used for the top or bottom floors as the `passing_floor` event does not fire for these floors.

The policy is to apply the first matching rule from the following:

1. If the floor has been requested by a passenger, stop at the floor
2. If the elevator is full, pass the floor
3. If anyone is waiting on the floor to travel in the elevator’s current direction, and no other elevator is scheduled to stop in that direction, stop at the floor
4. If the elevator has any more requested stops or is needed beyond the floor, pass the floor
5. If anyone is waiting on the floor to travel in the direction opposite to the elevator’s current direction, and no other elevator is schedule to stop in that direction, stop at the floor

If no rule matches, the elevator will turn around.

### Turning policy

When an elevator stops at a floor (or is approaching a floor and planning to stop), the turning policy is used to determine which way the elevator should travel when leaving the floor.

The policy is to apply the first matching rule from the following:

1. If the floor is the bottom floor, head up
2. If the floor is the top floor, head down
3. If the elevator has any more requested stops, continue in the current direction
4. If anyone is waiting on the floor to travel in the elevator’s current direction, continue in that direction
5. If the elevator is not needed beyond the floor, turn around

If no rule matches, the elevator will continue in its current direction.

### Is the elevator needed beyond a floor?

The concept of whether an elevator is needed beyond a floor prevents elevators continuing to the top or bottom floor unnecessarily.

To determine whether the elevator is needed, the first matching rule from the following is used:

1. If no-one is waiting beyond the floor, the elevator is not needed
2. If the elevator is going down, the elevator is needed
3. If anyone is waiting above the floor to go up, the elevator is needed
4. If another elevator is above this elevator and headed up, the elevator is not needed
5. If no-one is waiting above the highest downwards elevator to go down, the elevator is not needed

If no rule matches, the elevator is needed.

Rules 4 and 5 are used to prevent an elevator from continuing upwards to pick up anyone waiting to travel down if either a higher upwards elevator or a downwards elevator will pick them up instead.

Rule 3 uses simpler logic to continue upwards if anyone is waiting to travel up. While it may seem more efficient to check whether a higher upwards elevator will pick them up instead, this change to the algorithm did not improve waiting times so is not included in this published version.

Rules 4 and 5 assume that a single elevator will be able to pick up everyone waiting, which is frequently false for the bottom floor, so rule 2 prevents equivalent logic from being used for downwards elevators.

## Notes on the code

The code in [solution.js](solution.js) is split into small functions, each preceded by a comment explaining its purpose and parameters. These notes provide further explanation of the overall architecture and data structures used.

### Constants and variables

```javascript
const UP   = 0
const DOWN = 1
```

As there are only two possible directions, many solutions represent the direction with a boolean value. This leads to shorter code, but at the expense of readability, so we use constants to enumerate the possible values.

```javascript
const PASS = 0
const STOP = 1
const TURN = 2
```

Similarly, we use constants for the three possible outputs from the stopping policy.

```javascript
const TOP_FLOOR = Math.max(...floors.map(floor => floor.floorNum()))
```

Most solutions use `floors.length` to determine the top floor number. While this works in all of the current challenges, the API documentation does not guarantee that floor numbers are continuous, and in real life they sometimes aren’t: tall buildings in many countries often omit a 13th floor due to triskaidekaphobia. As a general principle, code is more robust when it doesn’t make assumptions about external APIs, so we explicitly determine the highest floor number, without assuming floor numbers are continuous or that the `floors` array is sorted.

```javascript
let waiting = [new Set(), new Set()]
```
We use two sets to store the lists of floors where someone is waiting to travel up or down. Using an array means the sets can be accessed as `waiting[direction]`, where `direction` is one of the constants `UP` or `DOWN`.

### Initialisation

```javascript
floors.forEach(floor => {
  floor.on('up_button_pressed',   () => setWaiting(floor.floorNum(), UP))
  floor.on('down_button_pressed', () => setWaiting(floor.floorNum(), DOWN))
})
```

We add listeners to each floor to record that someone is waiting to travel up or down.

```javascript
elevators.forEach(elevator => {

  elevator.stops = new Set()

  elevator.on('floor_button_pressed', floor => elevator.stops.add(floor))
  elevator.on('passing_floor', floor => handleApproach(elevator, floor))
  elevator.on('stopped_at_floor', floor => handleStop(elevator, floor))

})
```

We add a property to each elevator to store the list of requested stops as a set. Note that this is separate from the elevator’s destination queue. When an elevator button is pressed we add the floor to the list.

We also add listeners to handle the elevator approaching or stopping at a floor. These listeners use the stopping and turning policies to control the elevator.

### Selected functions

A few of the functions warrant further discussion.

#### setWaiting

```javascript
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
```

This function is the listener for the floor button press events. It implements the second part of the starting policy. We determine whether an elevator is idle by checking whether its `direction` property has been set, and use the `handleStop` function to start the first idle elevator moving up.

#### handleApproach

```javascript
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
```

This function is the listener for the `passing_floor` event. It acts on the response from the `getAction` function, which implements the stopping policy.

If the elevator should stop, we add the floor to the start of its destination queue. We then call `updateDirection`, which implements the turning policy and sets the direction that the elevator will travel after stopping. As described below, this prevents multiple elevators from stopping to pick up the same passengers.

If the elevator should turn, we reverse its direction and then call `applyDirection` to immediately start travelling in that direction.

#### handleStop

```javascript
function handleStop(elevator, floor){

  if (floor === 0 || floor === TOP_FLOOR){
    updateDirection(elevator, floor)
  }

  applyDirection(elevator)

}
```

This function is the listener for the `stopped_at_floor` event, and is also called when a elevator waiting on the bottom floor should start moving.

If the elevator is on the top or bottom floor, the `passing_floor` event will not have been fired, so we call `updateDirection` to set the direction that the elevator will travel.

We then call `applyDirection` to start the elevator travelling in its new direction.

#### updateDirection

```javascript
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
```

This function is called when an elevator is planning to stop, or has stopped, at a floor. It implements the turning policy and sets the direction that the elevator will travel after stopping.

It removes the floor from the elevator’s list of stops and from the list of floors where someone is waiting to travel in the new direction. By determining the new direction and updating the lists of floors in advance of stopping at the floor, this prevents multiple elevators from stopping to pick up the same passengers if they are simultaneously approaching the same floor.

#### applyDirection

```javascript
function applyDirection(elevator){

  elevator.goingUpIndicator(elevator.direction === UP)
  elevator.goingDownIndicator(elevator.direction === DOWN)

  elevator.destinationQueue = [(elevator.direction === UP ? TOP_FLOOR : 0)]
  elevator.checkDestinationQueue()

}
```

This function is called after an elevator has stopped, and starts the elevator moving in the new direction previously set by the `updateDirection` function. It updates the indicator lights and sets the destination queue to consist only of the top floor (to head up) or the bottom floor (to head down).
