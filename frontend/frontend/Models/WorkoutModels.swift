import Foundation

// MARK: - Core workout types (matches backend JSON)

struct WorkoutHeader: Codable {
    var poolLengthMeters: Int?
    var plannedDurationMinutes: Int?
    var title: String?
    var focus: String?
    var profile: String?
}

struct WorkoutSetInterval: Codable, Identifiable {
    let id = UUID()  // Local UUID for SwiftUI rendering

    var section: String
    var reps: Int
    var distanceMeters: Int
    var stroke: String
    var sendOffSeconds: Int?
    var intensity: String?
    var raw: String
    var lineNumber: Int
}

struct WorkoutTotals: Codable {
    var totalDistanceMeters: Int
    var distanceBySection: [String: Int]
    var distanceByIntensity: [String: Int]
    var estimatedMinutes: Double?
}

struct ParseErrorDTO: Codable, Identifiable {
    var id: Int { lineNumber }
    var lineNumber: Int
    var message: String
}

struct InterpretedWorkoutDTO: Codable {
    var header: WorkoutHeader
    var sets: [WorkoutSetInterval]
    var totals: WorkoutTotals
    var errors: [ParseErrorDTO]
    var warnings: [String]
}

// MARK: - Workout generation constraints

struct GenerateConstraintsDTO: Codable {
    var poolLengthMeters: Int
    var targetDistanceMeters: Int?
    var targetDurationMinutes: Int?
    var focus: String                // e.g., threshold, aerobic
    var profile: String              // novice/intermediate/elite
    var title: String?
}

struct GenerateResponseDTO: Codable {
    var dsl: String
    var interpreted: InterpretedWorkoutDTO
}

// MARK: - DB Workout records

struct WorkoutRecordDTO: Codable, Identifiable {
    var id: String
    var title: String?
    var poolLengthMeters: Int?
    var plannedDurationMinutes: Int?
    var focus: String?
    var profile: String?
    var shorthand: String
    var totalDistanceMeters: Int?
    var createdAt: Date
    var updatedAt: Date
}

struct CreateWorkoutRequestDTO: Codable {
    var title: String?
    var shorthand: String
    var poolLengthMeters: Int?
    var plannedDurationMinutes: Int?
    var focus: String?
    var profile: String?
}

struct CreateWorkoutResponseDTO: Codable {
    var workout: WorkoutRecordDTO
    var interpreted: InterpretedWorkoutDTO
}

struct ListWorkoutsResponseDTO: Codable {
    var workouts: [WorkoutRecordDTO]
}

struct GetWorkoutResponseDTO: Codable {
    var workout: WorkoutRecordDTO
    var interpreted: InterpretedWorkoutDTO
}
