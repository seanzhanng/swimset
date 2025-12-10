import SwiftUI

private enum WorkoutFocus: String, CaseIterable, Identifiable {
    case aerobic
    case threshold
    case sprint
    case technique

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .aerobic: return "Aerobic"
        case .threshold: return "Threshold"
        case .sprint: return "Sprint"
        case .technique: return "Technique"
        }
    }
}

private enum WorkoutProfile: String, CaseIterable, Identifiable {
    case novice
    case intermediate
    case elite

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .novice: return "Novice"
        case .intermediate: return "Intermediate"
        case .elite: return "Elite"
        }
    }
}

struct GenerateWorkoutView: View {

    // MARK: - Form state

    @State private var poolLengthMeters: Int = 25
    @State private var targetDistanceText: String = "3000"
    @State private var targetDurationText: String = ""
    @State private var selectedFocus: WorkoutFocus = .threshold
    @State private var selectedProfile: WorkoutProfile = .intermediate
    @State private var title: String = "Threshold Tuesday"

    // MARK: - Result state

    @State private var dsl: String?
    @State private var interpreted: InterpretedWorkoutDTO?
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    @State private var isSaving: Bool = false
    @State private var saveMessage: String?

    var body: some View {
        NavigationView {
            VStack(spacing: 12) {
                Form {
                    Section(header: Text("Constraints")) {
                        Picker("Pool length", selection: $poolLengthMeters) {
                            Text("25m").tag(25)
                            Text("50m").tag(50)
                        }
                        .pickerStyle(.segmented)

                        TextField("Target distance (m)", text: $targetDistanceText)
                            .keyboardType(.numberPad)

                        TextField("Target duration (min)", text: $targetDurationText)
                            .keyboardType(.numberPad)

                        Picker("Focus", selection: $selectedFocus) {
                            ForEach(WorkoutFocus.allCases) { focus in
                                Text(focus.displayName).tag(focus)
                            }
                        }

                        Picker("Profile", selection: $selectedProfile) {
                            ForEach(WorkoutProfile.allCases) { profile in
                                Text(profile.displayName).tag(profile)
                            }
                        }

                        TextField("Title (optional)", text: $title)
                    }

                    Section {
                        Button(action: generateTapped) {
                            if isLoading {
                                HStack {
                                    ProgressView()
                                        .progressViewStyle(.circular)
                                    Text("Generating…")
                                }
                            } else {
                                Text("Generate Workout")
                                    .fontWeight(.semibold)
                            }
                        }
                        .disabled(isLoading)

                        if let interpreted, dsl != nil {
                            Button(action: saveWorkoutTapped) {
                                if isSaving {
                                    HStack {
                                        ProgressView()
                                            .progressViewStyle(.circular)
                                        Text("Saving…")
                                    }
                                } else {
                                    Text("Save Workout")
                                        .fontWeight(.semibold)
                                }
                            }
                            .disabled(isSaving)
                        }
                    }

                    if let errorMessage {
                        Section {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundColor(.red)
                        }
                    }

                    if let saveMessage {
                        Section {
                            Text(saveMessage)
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }
                    }

                    if let dsl {
                        Section(header: Text("Generated DSL")) {
                            ScrollView {
                                Text(dsl)
                                    .font(.system(.body, design: .monospaced))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(minHeight: 120)
                        }
                    }

                    if let interpreted {
                        Section(header: Text("Workout Overview")) {
                            WorkoutResultsView(interpreted: interpreted)
                                .frame(minHeight: 300)
                        }
                    }
                }
            }
            .navigationTitle("Generate")
        }
    }

    // MARK: - Generate actions

    private func generateTapped() {
        Task {
            await generateAsync()
        }
    }

    private func generateAsync() async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
            saveMessage = nil
        }

        let distance = Int(targetDistanceText.trimmingCharacters(in: .whitespaces))
        let duration = Int(targetDurationText.trimmingCharacters(in: .whitespaces))

        let titleValue = title.trimmingCharacters(in: .whitespaces)
        let titleOrNil = titleValue.isEmpty ? nil : titleValue

        let constraints = GenerateConstraintsDTO(
            poolLengthMeters: poolLengthMeters,
            targetDistanceMeters: distance,
            targetDurationMinutes: duration,
            focus: selectedFocus.rawValue,
            profile: selectedProfile.rawValue,
            title: titleOrNil
        )

        do {
            let response = try await APIClient.shared.generate(constraints: constraints)
            await MainActor.run {
                self.dsl = response.dsl
                self.interpreted = response.interpreted
                self.isLoading = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.errorMessage = mapAPIError(apiError)
                self.isLoading = false
                self.dsl = nil
                self.interpreted = nil
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Unexpected error. Please try again."
                self.isLoading = false
                self.dsl = nil
                self.interpreted = nil
            }
        }
    }

    // MARK: - Save actions

    private func saveWorkoutTapped() {
        guard let interpreted, let dsl else {
            saveMessage = "Generate a workout before saving."
            return
        }

        if !interpreted.errors.isEmpty {
            saveMessage = "Fix parse errors before saving."
            return
        }

        Task {
            await saveWorkoutAsync(interpreted: interpreted, dsl: dsl)
        }
    }

    private func saveWorkoutAsync(interpreted: InterpretedWorkoutDTO, dsl: String) async {
        await MainActor.run {
            isSaving = true
            saveMessage = nil
        }

        let titleValue = title.trimmingCharacters(in: .whitespaces)
        let titleOrNil = titleValue.isEmpty ? nil : titleValue

        let requestDTO = CreateWorkoutRequestDTO(
            title: titleOrNil,
            shorthand: dsl,
            poolLengthMeters: interpreted.header.poolLengthMeters ?? poolLengthMeters,
            plannedDurationMinutes: interpreted.header.plannedDurationMinutes,
            focus: interpreted.header.focus ?? selectedFocus.rawValue,
            profile: interpreted.header.profile ?? selectedProfile.rawValue
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

#Preview {
    GenerateWorkoutView()
}
