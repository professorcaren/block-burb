#!/usr/bin/env python3
"""Generate Level 2 puzzle starts by reverse-scrambling solved boards.

A reverse scramble is a sequence of legal moves applied backward from a solved board.
Because each reverse move has a legal inverse, every generated start has a valid solution
back to a solved state.
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

N = 8
NEIGHBOR_STEPS = [
    (-1, 0),
    (1, 0),
    (0, -1),
    (0, 1),
    (-1, -1),
    (-1, 1),
    (1, -1),
    (1, 1),
]
PAIR_OFFSETS = [(0, 1), (1, 0), (1, 1), (1, -1)]

SOLVED_SEEDS: List[List[str]] = [
    [
        '.OBO.BOO',
        'OBBOOBB.',
        '.BBBBBBO',
        'BBBOBBOB',
        'B.OOO.BB',
        'B.B.B.OO',
        '.OOBOOOB',
        'BBO..OBB',
    ],
    [
        'B.BBOBOO',
        'B.BOBOBO',
        'B.BBB...',
        '.B..BOBO',
        '.OOOBBOO',
        'B.OBBOBB',
        'OBOOBOOB',
        'OBOBBB.B',
    ],
]


@dataclass(frozen=True)
class TierSpec:
    name: str
    count: int
    depth_min: int
    depth_max: int
    min_unhappy: int
    turn_budget: int


TIER_SPECS = [
    TierSpec('easy', count=2, depth_min=6, depth_max=9, min_unhappy=8, turn_budget=24),
    TierSpec('medium', count=2, depth_min=11, depth_max=14, min_unhappy=10, turn_budget=30),
    TierSpec('hard', count=2, depth_min=16, depth_max=20, min_unhappy=12, turn_budget=36),
]


@dataclass
class Metrics:
    unhappy: int
    segregation: int


@dataclass
class Puzzle:
    puzzle_id: str
    title: str
    difficulty: str
    reverse_depth: int
    turn_budget: int
    start_unhappy: int
    start_segregation: int
    start_board: List[str]
    solved_seed: List[str]


def index(row: int, col: int) -> int:
    return row * N + col


def in_bounds(row: int, col: int) -> bool:
    return 0 <= row < N and 0 <= col < N


def flatten(rows: Sequence[str]) -> Tuple[str, ...]:
    assert len(rows) == N
    for row in rows:
        assert len(row) == N
    return tuple(''.join(rows))


def to_rows(board: Sequence[str]) -> List[str]:
    return [''.join(board[row * N : (row + 1) * N]) for row in range(N)]


def evaluate(board: Sequence[str]) -> Metrics:
    unhappy = 0
    same = 0
    mixed = 0

    for row in range(N):
        for col in range(N):
            current = board[index(row, col)]
            if current == '.':
                continue

            occupied_neighbors = 0
            same_color_neighbors = 0
            for d_row, d_col in NEIGHBOR_STEPS:
                n_row, n_col = row + d_row, col + d_col
                if not in_bounds(n_row, n_col):
                    continue

                neighbor = board[index(n_row, n_col)]
                if neighbor == '.':
                    continue

                occupied_neighbors += 1
                if neighbor == current:
                    same_color_neighbors += 1

            if occupied_neighbors > 0 and same_color_neighbors == 0:
                unhappy += 1

            for d_row, d_col in PAIR_OFFSETS:
                n_row, n_col = row + d_row, col + d_col
                if not in_bounds(n_row, n_col):
                    continue
                neighbor = board[index(n_row, n_col)]
                if neighbor == '.':
                    continue

                if neighbor == current:
                    same += 1
                else:
                    mixed += 1

    total = same + mixed
    segregation = round((same / total) * 100) if total > 0 else 0
    return Metrics(unhappy=unhappy, segregation=segregation)


def move(board: Sequence[str], src: int, dst: int) -> Tuple[str, ...]:
    mutable = list(board)
    mutable[dst] = mutable[src]
    mutable[src] = '.'
    return tuple(mutable)


def households_and_vacancies(board: Sequence[str]) -> Tuple[List[int], List[int]]:
    households = [idx for idx, value in enumerate(board) if value != '.']
    vacancies = [idx for idx, value in enumerate(board) if value == '.']
    return households, vacancies


def reverse_scramble(solved: Tuple[str, ...], depth: int, rng: random.Random) -> Tuple[Tuple[str, ...], List[Tuple[int, int]]]:
    board = solved
    reverse_moves: List[Tuple[int, int]] = []
    previous: Tuple[int, int] | None = None

    for _ in range(depth):
        households, vacancies = households_and_vacancies(board)
        base_metrics = evaluate(board)

        best_choice = None
        for _ in range(200):
            src = rng.choice(households)
            dst = rng.choice(vacancies)
            if previous is not None and src == previous[1] and dst == previous[0]:
                continue

            candidate = move(board, src, dst)
            candidate_metrics = evaluate(candidate)

            # Bias toward starts with more unhappy households.
            score = (candidate_metrics.unhappy - base_metrics.unhappy) * 8
            score += (candidate_metrics.segregation - base_metrics.segregation) * 0.2
            score += rng.random() * 0.2

            if best_choice is None or score > best_choice[0]:
                best_choice = (score, src, dst, candidate)

        if best_choice is None:
            src = rng.choice(households)
            dst = rng.choice(vacancies)
            board = move(board, src, dst)
            reverse_moves.append((src, dst))
            previous = (src, dst)
            continue

        _, src, dst, board = best_choice
        reverse_moves.append((src, dst))
        previous = (src, dst)

    # The legal solution from start -> solved is the inverse sequence.
    solution_moves = [(dst, src) for src, dst in reversed(reverse_moves)]
    return board, solution_moves


def apply_moves(board: Tuple[str, ...], moves: Iterable[Tuple[int, int]]) -> Tuple[str, ...] | None:
    current = board
    for src, dst in moves:
        if current[src] == '.' or current[dst] != '.':
            return None
        current = move(current, src, dst)
    return current


def build_puzzles(seed: int) -> List[Puzzle]:
    rng = random.Random(seed)
    solved_boards = [flatten(rows) for rows in SOLVED_SEEDS]

    puzzles: List[Puzzle] = []
    counters = {'easy': 0, 'medium': 0, 'hard': 0}

    for tier in TIER_SPECS:
        for solved in solved_boards:
            if counters[tier.name] >= tier.count:
                break

            for _ in range(120):
                depth = rng.randint(tier.depth_min, tier.depth_max)
                start_board, solution = reverse_scramble(solved, depth, rng)
                start_metrics = evaluate(start_board)

                if start_metrics.unhappy < tier.min_unhappy:
                    continue

                end_board = apply_moves(start_board, solution)
                if end_board is None:
                    continue

                end_metrics = evaluate(end_board)
                if end_metrics.unhappy != 0 or end_metrics.segregation > 55:
                    continue

                counters[tier.name] += 1
                number = counters[tier.name]
                puzzles.append(
                    Puzzle(
                        puzzle_id=f'l2-{tier.name}-{number}',
                        title=f"{tier.name.capitalize()} {number}",
                        difficulty=tier.name,
                        reverse_depth=depth,
                        turn_budget=tier.turn_budget,
                        start_unhappy=start_metrics.unhappy,
                        start_segregation=start_metrics.segregation,
                        start_board=to_rows(start_board),
                        solved_seed=to_rows(solved),
                    )
                )
                break

        if counters[tier.name] < tier.count:
            raise RuntimeError(f"Unable to generate enough {tier.name} puzzles (needed {tier.count}, got {counters[tier.name]})")

    return puzzles


def puzzles_as_json(puzzles: Sequence[Puzzle]) -> str:
    payload = [
        {
            'id': p.puzzle_id,
            'title': p.title,
            'difficulty': p.difficulty,
            'reverse_depth': p.reverse_depth,
            'turn_budget': p.turn_budget,
            'start_unhappy': p.start_unhappy,
            'start_segregation': p.start_segregation,
            'start_board': p.start_board,
            'solved_seed': p.solved_seed,
        }
        for p in puzzles
    ]
    return json.dumps(payload, indent=2)


def write_ts(puzzles: Sequence[Puzzle], path: Path) -> None:
    lines = [
        "// Auto-generated by scripts/level2_reverse_solver.py",
        "export const GENERATED_LEVEL2_PUZZLES = [",
    ]

    for puzzle in puzzles:
        lines.extend(
            [
                "  {",
                f"    id: '{puzzle.puzzle_id}',",
                f"    title: '{puzzle.title}',",
                f"    difficulty: '{puzzle.difficulty}',",
                f"    reverseDepth: {puzzle.reverse_depth},",
                f"    turnBudget: {puzzle.turn_budget},",
                f"    startUnhappy: {puzzle.start_unhappy},",
                f"    startSegregation: {puzzle.start_segregation},",
                "    startBoard: [",
            ]
        )
        for row in puzzle.start_board:
            lines.append(f"      '{row}',")
        lines.extend(
            [
                "    ],",
                "    solvedSeed: [",
            ]
        )
        for row in puzzle.solved_seed:
            lines.append(f"      '{row}',")
        lines.extend(["    ],", "  },"])

    lines.append("] as const")
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate reverse-solved Level 2 puzzles')
    parser.add_argument('--seed', type=int, default=2026)
    parser.add_argument('--write-ts', type=Path, default=None, help='Optional path for TS output')
    args = parser.parse_args()

    puzzles = build_puzzles(args.seed)
    print(puzzles_as_json(puzzles))

    if args.write_ts is not None:
        write_ts(puzzles, args.write_ts)


if __name__ == '__main__':
    main()
