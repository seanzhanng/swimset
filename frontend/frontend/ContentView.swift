import SwiftUI

struct ContentView: View {

    // MARK: - State

    @State private var workoutTitle: String = "Threshold Tuesday"

    @State private var shorthandText: String = """
    pool 25m
    duration 90min

    warmup:
      200 FR easy
      4x50 drill @1:00

    main:
      10x100 FR @1:40 thresh

    cooldown:
      100 choice easy
    """

    @State private var interpreted: InterpretedWorkoutDTO?
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    @State private var isSaving: Bool = false
    @State private var saveMessage: String?

    // MARK: - Body

    var body: some View {
        NavigationView {
            VStack(spacing: 16) {

                // MARK: Title + Input editor

                VStack(alignment: .leading, spacing: 8) {
                    Text("Title")
                        .font(.headline)

                    TextField("Optional workout title", text: $workoutTitle)
                        .textFieldStyle(.roundedBorder)

                    Text("Shorthand Workout")
                        .font(.headline)

                    TextEditor(text: $shorthandText)
                        .font(.system(.body, design: .monospaced))
                        .padding(8)
                        .frame(minHeight: 200)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                }

                // MARK: Buttons + status

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 12) {
                        Button(action: interpretButtonTapped) {
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .padding(.trailing, 4)
                                Text("Interpreting...")
                            } else {
                                Text("Interpret")
                                    .fontWeight(.semibold)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isLoading)

                        Button(action: saveWorkoutTapped) {
                            if isSaving {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .padding(.trailing, 4)
                                Text("Saving...")
                            } else {
                                Text("Save Workout")
                                    .fontWeight(.semibold)
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isSaving || interpreted == nil)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundColor(.red)
                    }

                    if let saveMessage {
                        Text(saveMessage)
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }

                // MARK: Results

                if let interpreted {
                    Divider()
                    WorkoutResultsView(interpreted: interpreted)
                } else {
                    Spacer()
                }
            }
            .padding()
            .navigationTitle("SwimSet")
        }
    }

    // MARK: - Interpret actions

    private func interpretButtonTapped() {
        let trimmed = shorthandText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Please enter a workout before interpreting."
            interpreted = nil
            return
        }

        Task {
            await interpretAsync(text: trimmed)
        }
    }

    private func interpretAsync(text: String) async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
            saveMessage = nil
        }

        do {
            let result = try await APIClient.shared.interpret(shorthand: text)
            await MainActor.run {
                self.interpreted = result
                self.isLoading = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.errorMessage = mapAPIError(apiError)
                self.isLoading = false
                self.interpreted = nil
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Unexpected error. Please try again."
                self.isLoading = false
                self.interpreted = nil
            }
        }
    }

    // MARK: - Save actions

    private func saveWorkoutTapped() {
        guard let interpreted else {
            saveMessage = "Interpret the workout before saving."
            return
        }

        if !interpreted.errors.isEmpty {
            saveMessage = "Fix parse errors before saving."
            return
        }

        Task {
            await saveWorkoutAsync(interpreted: interpreted)
        }
    }

    private func saveWorkoutAsync(interpreted: InterpretedWorkoutDTO) async {
        await MainActor.run {
            isSaving = true
            saveMessage = nil
        }

        let trimmedTitle = workoutTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let titleOrNil = trimmedTitle.isEmpty ? nil : trimmedTitle

        let requestDTO = CreateWorkoutRequestDTO(
            title: titleOrNil,
            shorthand: shorthandText,
            poolLengthMeters: interpreted.header.poolLengthMeters,
            plannedDurationMinutes: interpreted.header.plannedDurationMinutes,
            focus: interpreted.header.focus,
            profile: interpreted.header.profile
        )

        do {
            let response = try await APIClient.shared.createWorkout(requestDTO)
            await MainActor.run {
                self.isSaving = false
                self.saveMessage = "Saved workout (\(response.workout.id.prefix(8))…)."
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.isSaving = false
                self.saveMessage = "Save failed: \(mapAPIError(apiError))"
            }
        } catch {
            await MainActor.run {
                self.isSaving = false
                self.saveMessage = "Save failed due to an unexpected error."
            }
        }
    }

    // MARK: - Error mapping

    private func mapAPIError(_ error: APIError) -> String {
        switch error {
        case .invalidURL:
            return "Invalid backend URL."
        case .badStatusCode(let code):
            return "server error \(code)"
        case .decodingFailed:
            return "decode failure"
        case .encodingFailed:
            return "encode failure"
        case .noData:
            return "no data from server"
        }
    }
}

// MARK: - Results View (shared by Write + Generate)

struct WorkoutResultsView: View {
    let interpreted: InterpretedWorkoutDTO

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {

                // Summary
                VStack(alignment: .leading, spacing: 4) {
                    Text("Summary")
                        .font(.headline)

                    let totals = interpreted.totals
                    Text("Total distance: \(totals.totalDistanceMeters) m")
                    if let est = totals.estimatedMinutes {
                        Text(String(format: "Estimated duration: %.1f min", est))
                    }
                }

                // Sets grouped by section
                ForEach(groupSetsBySection(interpreted.sets), id: \.section) { section in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(section.section.capitalized)
                                .font(.headline)
                            Spacer()
                            let sectionDistance = interpreted.totals.distanceBySection[section.section] ?? 0
                            Text("\(sectionDistance) m")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        ForEach(section.sets) { set in
                            HStack {
                                Text("\(set.reps) x \(set.distanceMeters)m")
                                    .font(.body)
                                Text(set.stroke)
                                    .font(.body)
                                Spacer()
                                if let sendOff = set.sendOffSeconds {
                                    Text(formatSendOff(sendOff))
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                if let intensity = set.intensity {
                                    Text(intensity)
                                        .font(.caption)
                                        .padding(4)
                                        .background(Color.blue.opacity(0.1))
                                        .cornerRadius(4)
                                }
                            }
                        }
                    }
                    .padding(8)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(8)
                }

                // Warnings
                if !interpreted.warnings.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Warnings")
                            .font(.headline)
                        ForEach(interpreted.warnings, id: \.self) { warning in
                            Text("• \(warning)")
                                .font(.footnote)
                                .foregroundColor(.orange)
                        }
                    }
                }

                // Parse errors (if any)
                if !interpreted.errors.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Parse Errors")
                            .font(.headline)
                        ForEach(interpreted.errors) { error in
                            Text("Line \(error.lineNumber): \(error.message)")
                                .font(.footnote)
                                .foregroundColor(.red)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func groupSetsBySection(_ sets: [WorkoutSetInterval]) -> [SectionGroup] {
        var dict: [String: [WorkoutSetInterval]] = [:]
        for set in sets {
            dict[set.section, default: []].append(set)
        }
        return dict.keys.sorted().map { key in
            SectionGroup(section: key, sets: dict[key] ?? [])
        }
    }

    private func formatSendOff(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let remaining = seconds % 60
        return String(format: "%d:%02d", minutes, remaining)
    }

    struct SectionGroup {
        let section: String
        let sets: [WorkoutSetInterval]
    }
}

#Preview {
    ContentView()
}
